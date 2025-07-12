
'use server';

import {db} from '@/lib/firebase';
import {
  doc,
  runTransaction,
  serverTimestamp,
  type DocumentReference,
} from 'firebase/firestore';
import type {
  InventoryItemInput,
  SaleTransactionInput,
  SaleItem,
} from '@/lib/schemas';
import {format} from 'date-fns';
import {v4 as uuidv4} from 'uuid';

// This is a helper function that might be moved to a shared location later.
async function checkIfDayIsClosed(
  dateToCheck: Date = new Date()
): Promise<boolean> {
  const { getDocs, query, collection, where } = await import('firebase/firestore');
  const dateString = format(dateToCheck, 'yyyy-MM-dd');
  const walletQuery = query(
    collection(db, 'walletHistory'),
    where('date', '==', dateString),
    where('status', '==', 'closed')
  );
  const walletSnapshot = await getDocs(walletQuery);
  return !walletSnapshot.empty;
}

// Action to submit a sales transaction
export async function submitSaleTransaction(
  saleData: SaleTransactionInput
): Promise<{success: boolean; message?: string; transactionId?: string}> {
  const dayIsClosed = await checkIfDayIsClosed();
  if (dayIsClosed) {
    return {
      success: false,
      message: 'Cannot record a sale. The daily session is already closed.',
    };
  }

  if (!saleData.items || saleData.items.length === 0) {
    return {success: false, message: 'No items in the report.'};
  }
  let transactionId: string | null = null;
  try {
    const counterRef = doc(db, 'counters', 'saleReceipt');

    await runTransaction(db, async (transaction) => {
      // Get the current counter value
      const counterDoc = await transaction.get(counterRef);
      let newReceiptNumber = 1;
      if (counterDoc.exists()) {
        newReceiptNumber = (counterDoc.data().currentNumber || 0) + 1;
      }

      // Format the receipt number with leading zeros
      const formattedReceiptNumber = String(newReceiptNumber).padStart(6, '0');

      const newId = `${format(
        new Date(),
        'yyyyMMdd_HHmmss'
      )}-S-${formattedReceiptNumber}`;
      transactionId = newId;
      const transactionRef = doc(db, 'saleTransactions', newId);

      const updatedSaleItems: SaleItem[] = [];
      const newInventoryItems: {ref: DocumentReference, data: InventoryItemInput}[] = [];
      const inventoryToUpdate = new Map<string, {ref: DocumentReference, quantity: number}>();
      
      // Step 1: Prepare all data. Separate new items from existing ones.
      for (const item of saleData.items) {
        if (!item.itemId) {
          // This is a new item to be created.
          const newItemId = `${format(new Date(), 'yyyyMMdd_HHmmss')}-I-${uuidv4().substring(0, 6)}`;
          const newItemRef = doc(db, 'inventory', newItemId);
          newInventoryItems.push({
            ref: newItemRef,
            data: {
              name: item.itemName,
              price: item.unitPrice,
              cost: 0,
              stock: 100,
            }
          });
          updatedSaleItems.push({ ...item, itemId: newItemId });
        } else {
          // This is an existing item to be updated.
          const existing = inventoryToUpdate.get(item.itemId);
          inventoryToUpdate.set(item.itemId, {
            ref: doc(db, 'inventory', item.itemId),
            quantity: (existing?.quantity || 0) + item.quantity
          });
          updatedSaleItems.push(item);
        }
      }

      // Step 2: Read Phase. Read all required inventory documents.
      const inventoryRefs = Array.from(inventoryToUpdate.values()).map(i => i.ref);
      const inventoryDocs = inventoryRefs.length > 0
        ? await Promise.all(inventoryRefs.map(ref => transaction.get(ref)))
        : [];

      const inventoryUpdates: {ref: DocumentReference, newStock: number}[] = [];

      // Step 3: Validate stock levels from the read data.
      for (const inventoryDoc of inventoryDocs) {
        if (!inventoryDoc.exists()) {
          throw new Error(`Inventory item with ID ${inventoryDoc.id} not found.`);
        }
        const required = inventoryToUpdate.get(inventoryDoc.id)!;
        const currentStock = inventoryDoc.data().stock as number;
        if (currentStock < required.quantity) {
          throw new Error(`Insufficient stock for "${inventoryDoc.data().name}". Available: ${currentStock}, Requested: ${required.quantity}.`);
        }
        inventoryUpdates.push({
          ref: inventoryDoc.ref,
          newStock: currentStock - required.quantity
        });
      }

      // Step 4: Write Phase. Perform all write operations now.
      // Write 1: Create the main sale transaction document with updated items.
      transaction.set(transactionRef, {
        ...saleData,
        items: updatedSaleItems,
        receiptNumber: formattedReceiptNumber,
        createdAt: serverTimestamp(),
        status: 'active',
      });
      
      // Write 2: Create all new inventory items.
      for (const { ref, data } of newInventoryItems) {
        transaction.set(ref, {
          ...data,
          createdAt: serverTimestamp(),
        });
      }

      // Write 3: Update all existing inventory items' stock.
      for (const update of inventoryUpdates) {
        transaction.update(update.ref, { stock: update.newStock });
      }

      // Write 4: Update the receipt counter.
      transaction.set(counterRef, { currentNumber: newReceiptNumber });
    });

    return {success: true, transactionId: transactionId};
  } catch (error) {
    console.error('Error in sales transaction: ', error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {
      success: false,
      message: `Transaction failed: ${message}`,
    };
  }
}

const formatCurrency = (value: number) =>
  `₱${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export async function submitGcashTransaction(
  type: 'cash-in' | 'cash-out' | 'e-load',
  amount: number
): Promise<{success: boolean; message?: string}> {
  try {
    let items: SaleItem[] = [];
    let customerName = '';
    let total = 0;
    let serviceType = 'gcash';

    if (type === 'cash-in') {
      const serviceFee = Math.max(10, amount * 0.01);
      items = [
        {
          itemName: 'Gcash Cash-In',
          quantity: 1,
          unitPrice: amount,
          total: amount,
        },
        {
          itemName: 'Gcash Cash-In Fee',
          quantity: 1,
          unitPrice: serviceFee,
          total: serviceFee,
        },
      ];
      customerName = `G-Cash In (${formatCurrency(amount)})`;
      total = serviceFee; // Only the fee is your revenue
    } else if (type === 'cash-out') {
      const serviceFee = Math.max(10, amount * 0.01);
      items = [
        {
          itemName: 'Gcash Cash-Out',
          quantity: 1,
          unitPrice: amount, // Positive amount, as it's a "sale" of cash from your drawer
          total: amount,
        },
        {
          itemName: 'Gcash Cash-Out Fee',
          quantity: 1,
          unitPrice: serviceFee,
          total: serviceFee,
        },
      ];
      customerName = `G-Cash Out (${formatCurrency(amount)})`;
      total = amount + serviceFee; // The total cash out from your drawer
    } else if (type === 'e-load') {
      const serviceFee = 2;
      items = [
        {
          itemName: `E-Load (${formatCurrency(amount)})`,
          quantity: 1,
          unitPrice: amount,
          total: amount,
        },
        {
          itemName: `E-Load Fee`,
          quantity: 1,
          unitPrice: serviceFee,
          total: serviceFee,
        },
      ];
      customerName = 'E-Load';
      total = serviceFee; // Only the fee is your revenue
      serviceType = 'gcash-e-load';
    }

    await submitSaleTransaction({
      items,
      customerName,
      total,
      status: 'active',
      serviceType,
    });

    return {success: true};
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {success: false, message};
  }
}

export async function voidSaleTransaction(
  transactionId: string
): Promise<{success: boolean; message?: string}> {
  if (!transactionId) {
    return {success: false, message: 'Transaction ID is missing.'};
  }

  const transactionRef = doc(db, 'saleTransactions', transactionId);

  try {
    await runTransaction(db, async (transaction) => {
      const transactionDoc = await transaction.get(transactionRef);
      if (!transactionDoc.exists()) {
        throw new Error('Transaction not found.');
      }
      if (transactionDoc.data().status === 'voided') {
        throw new Error('This transaction has already been voided.');
      }

      const items = transactionDoc.data().items as SaleItem[];

      // Restore inventory stock
      for (const item of items) {
        if (item.itemId) {
          const inventoryRef = doc(db, 'inventory', item.itemId);
          const inventoryDoc = await transaction.get(inventoryRef);
          if (inventoryDoc.exists()) {
            const currentStock = inventoryDoc.data().stock as number;
            transaction.update(inventoryRef, {
              stock: currentStock + item.quantity,
            });
          }
        }
      }

      // Mark transaction as voided
      transaction.update(transactionRef, {
        status: 'voided',
        voidedAt: serverTimestamp(),
      });
    });

    return {success: true};
  } catch (error) {
    console.error('Error voiding transaction:', error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {success: false, message: `Transaction failed: ${message}`};
  }
}
