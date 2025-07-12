
'use server';

import {db} from '@/lib/firebase';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
  setDoc,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import type {
  InventoryItemInput,
  LedgerTransaction,
  LedgerTransactionInput,
  SaleTransactionInput,
  SaleItem,
  DiagnoseReceiptInputWithSource,
} from '@/lib/schemas';
import {format} from 'date-fns';
import {v4 as uuidv4} from 'uuid';
import type {DiagnoseReceiptOutput} from '@/ai/flows/diagnose-receipt-flow';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

// --- Other Actions (Unchanged) ---
type NotificationStatus = {
  success: boolean;
  message?: string;
};

export type ActionResponse = {
  diagnosis: DiagnoseReceiptOutput;
  notificationStatus: NotificationStatus;
};

// --- Wallet Status Check ---
async function checkIfDayIsClosed(
  dateToCheck: Date = new Date()
): Promise<boolean> {
  const dateString = format(dateToCheck, 'yyyy-MM-dd');
  const walletQuery = query(
    collection(db, 'walletHistory'),
    where('date', '==', dateString),
    where('status', '==', 'closed')
  );
  const walletSnapshot = await getDocs(walletQuery);
  return !walletSnapshot.empty;
}

function escapeMarkdownV2(text: string): string {
  const charsToEscape = /[_*[\]()~`>#+\-=|{}.!]/g;
  return text.replace(charsToEscape, '\\$&');
}

function dataURItoBlob(dataURI: string): Blob {
  const [header, base64Data] = dataURI.split(',');
  if (!header || !base64Data) {
    throw new Error('Invalid Data URI');
  }
  const mimeString = header.split(':')[1].split(';')[0];
  const buffer = Buffer.from(base64Data, 'base64');
  return new Blob([buffer], {type: mimeString});
}

async function notifyOnTelegram(
  diagnosis: DiagnoseReceiptOutput,
  photoDataUri?: string
): Promise<NotificationStatus> {
  if (!BOT_TOKEN || !CHANNEL_ID) {
    console.warn(
      'Telegram environment variables not set. Skipping channel notifications.'
    );
    return {success: false, message: 'Telegram not configured.'};
  }

  const formatToPHP = (value: number) => {
    return (
      '₱' +
      value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  };

  try {
    const caption = [
      `🧾 *Receipt Scanned* 🧾`,
      ``,
      `*Merchant:* ${escapeMarkdownV2(diagnosis.merchantName)}`,
      `*Date:* ${escapeMarkdownV2(
        new Date(diagnosis.transactionDate + 'T00:00:00').toLocaleDateString(
          undefined,
          {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }
        )
      )}`,
      `*Category:* ${escapeMarkdownV2(diagnosis.category)}`,
      `*Total:* ${escapeMarkdownV2(formatToPHP(diagnosis.total))}`,
      ``,
      `*Items:*`,
      ...diagnosis.items.map(
        (item) =>
          `\\- ${escapeMarkdownV2(item.name)}: ${escapeMarkdownV2(
            formatToPHP(item.price)
          )}`
      ),
    ].join('\n');

    const parseMode = 'MarkdownV2';

    let response: Response;
    if (photoDataUri) {
      const blob = dataURItoBlob(photoDataUri);
      const formData = new FormData();
      formData.append('chat_id', CHANNEL_ID);
      formData.append('photo', blob, 'receipt.jpg');
      formData.append('caption', caption);
      formData.append('parse_mode', parseMode);

      const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
      response = await fetch(url, {method: 'POST', body: formData});
    } else {
      const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
      const body = {
        chat_id: CHANNEL_ID,
        text: caption,
        parse_mode: parseMode,
      };

      response = await fetch(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
      });
    }

    if (!response.ok) {
      const errorData = await response.json();
      console.error(
        'Telegram API Error:',
        JSON.stringify(errorData, null, 2)
      );
      const description =
        errorData.description || 'Telegram API returned an error.';
      return {success: false, message: `Telegram Error: ${description}`};
    }

    return {success: true};
  } catch (error) {
    console.error('Error sending notification to Telegram:', error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {
      success: false,
      message: `A network error occurred while sending to Telegram: ${message}`,
    };
  }
}

async function saveReceiptToFirestore(
  receiptData: DiagnoseReceiptInputWithSource,
  imagePreview?: string
) {
  try {
    // Save to the receipts collection
    const newReceiptId = `${format(
      new Date(),
      'yyyyMMdd_HHmmss'
    )}-E-${uuidv4().substring(0, 6)}`;
    const receiptDocRef = doc(db, 'receipts', newReceiptId);
    
    await setDoc(receiptDocRef, {
      ...receiptData,
      imagePreview: imagePreview || null,
      createdAt: serverTimestamp(),
    });

  } catch (error) {
    console.error('Error writing document to Firestore: ', error);
    throw new Error('Could not save receipt to database.');
  }
}

export async function submitManualReceipt(
  data: DiagnoseReceiptInputWithSource,
  imagePreview?: string
): Promise<ActionResponse> {
  const dayIsClosed = await checkIfDayIsClosed(
    new Date(data.transactionDate)
  );
  if (dayIsClosed) {
    throw new Error('Cannot record an expense for a closed day.');
  }

  await saveReceiptToFirestore(data, imagePreview);
  const notificationStatus = await notifyOnTelegram(data, imagePreview);
  return {diagnosis: data, notificationStatus};
}

// Actions for Credit Ledger
export async function addCustomer(data: {
  name: string;
  amount: number;
  description?: string;
}): Promise<{success: boolean; message?: string}> {
  try {
    await runTransaction(db, async (transaction) => {
      const timestamp = new Date();
      
      // Sanitize the first name and create the custom ID
      const firstName = data.name.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '');
      const formattedTimestamp = format(timestamp, 'ddMMyy_HHmmss');
      const shortUuid = uuidv4().substring(0, 6);
      const customerId = `${firstName}-${formattedTimestamp}-${shortUuid}`;

      const customerRef = doc(db, 'customers', customerId);
      transaction.set(customerRef, {
        name: data.name,
        status: 'active',
        createdAt: serverTimestamp(),
      });

      if (data.amount > 0) {
        const ledgerId = `${format(
          timestamp,
          'yyyyMMdd_HHmmss'
        )}-L-${shortUuid}`;
        const ledgerRef = doc(db, 'ledger', ledgerId);
        transaction.set(ledgerRef, {
          customerId: customerRef.id,
          type: 'credit',
          amount: data.amount,
          description: data.description || 'Initial balance',
          status: 'active',
          paidAmount: 0,
          createdAt: serverTimestamp(),
        });
      }
    });
    return {success: true};
  } catch (error) {
    console.error('Error adding customer with transaction: ', error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {success: false, message: `Could not add customer: ${message}`};
  }
}

export async function updateCustomerName(
  id: string,
  name: string
): Promise<{success: boolean; message?: string}> {
  try {
    if (!name.trim()) {
      return {success: false, message: 'Customer name cannot be empty.'};
    }
    const customerRef = doc(db, 'customers', id);
    await updateDoc(customerRef, {name});
    return {success: true};
  } catch (error) {
    console.error('Error updating customer name: ', error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {success: false, message: `Could not update name: ${message}`};
  }
}

export async function addLedgerTransaction(
  transactionData: LedgerTransactionInput
): Promise<{success: boolean; message?: string}> {
  const dayIsClosed = await checkIfDayIsClosed();
  if (dayIsClosed) {
    return {
      success: false,
      message: 'Cannot record a transaction. The daily session is already closed.',
    };
  }
  try {
    await runTransaction(db, async (transaction) => {
      const newId = `${format(
        new Date(),
        'yyyyMMdd_HHmmss'
      )}-L-${uuidv4().substring(0, 6)}`;
      const docRef = doc(db, 'ledger', newId);

      // Handle credit transaction
      if (transactionData.type === 'credit') {
        const updatedSaleItems: SaleItem[] = [];
        const newInventoryItems: {ref: DocumentReference, data: InventoryItemInput}[] = [];
        const inventoryToUpdate = new Map<string, {ref: DocumentReference, quantity: number}>();
        
        for (const item of transactionData.items || []) {
          if (!item.itemId) {
            const newItemId = `${format(new Date(), 'yyyyMMdd_HHmmss')}-I-${uuidv4().substring(0, 6)}`;
            const newItemRef = doc(db, 'inventory', newItemId);
            newInventoryItems.push({
              ref: newItemRef,
              data: { name: item.itemName, price: item.unitPrice, cost: 0, stock: 100 }
            });
            updatedSaleItems.push({ ...item, itemId: newItemId });
          } else {
            const existing = inventoryToUpdate.get(item.itemId);
            inventoryToUpdate.set(item.itemId, {
              ref: doc(db, 'inventory', item.itemId),
              quantity: (existing?.quantity || 0) + item.quantity
            });
            updatedSaleItems.push(item);
          }
        }
        
        const inventoryRefs = Array.from(inventoryToUpdate.values()).map(i => i.ref);
        const inventoryDocs = inventoryRefs.length > 0 ? await Promise.all(inventoryRefs.map(ref => transaction.get(ref))) : [];
        const inventoryUpdates: {ref: DocumentReference, newStock: number}[] = [];

        for (const inventoryDoc of inventoryDocs) {
          if (!inventoryDoc.exists()) throw new Error(`Inventory item with ID ${inventoryDoc.id} not found.`);
          const required = inventoryToUpdate.get(inventoryDoc.id)!;
          const currentStock = inventoryDoc.data().stock as number;
          if (currentStock < required.quantity) throw new Error(`Insufficient stock for "${inventoryDoc.data().name}". Available: ${currentStock}, Requested: ${required.quantity}.`);
          inventoryUpdates.push({ ref: inventoryDoc.ref, newStock: currentStock - required.quantity });
        }
        
        for (const { ref, data } of newInventoryItems) {
          transaction.set(ref, { ...data, createdAt: serverTimestamp() });
        }
        for (const update of inventoryUpdates) {
          transaction.update(update.ref, { stock: update.newStock });
        }

        transaction.set(docRef, { 
          ...transactionData, 
          items: updatedSaleItems, 
          status: 'active', 
          paidAmount: 0,
          createdAt: serverTimestamp() 
        });

      } else { // Handle payment transaction
        
        // If specific credits are paid off, update their `paidAmount`
        if (transactionData.paidCreditIds && transactionData.paidCreditIds.length > 0) {
            // READ PHASE: Get all credit documents first.
            const creditRefs = transactionData.paidCreditIds.map(id => doc(db, 'ledger', id));
            const creditDocs = await Promise.all(creditRefs.map(ref => transaction.get(ref)));
            
            // WRITE PHASE: Now, perform all the updates.
            for (const creditDoc of creditDocs) {
                if (creditDoc.exists()) {
                    const creditData = creditDoc.data() as LedgerTransaction;
                    transaction.update(creditDoc.ref, { paidAmount: creditData.amount }); // Mark as fully paid
                }
            }
        } else {
            // This is a general payment, apply it to the oldest outstanding credits (FIFO)
            let paymentRemaining = transactionData.amount;
            const outstandingCreditsQuery = query(
              collection(db, 'ledger'),
              where('customerId', '==', transactionData.customerId),
              where('type', '==', 'credit'),
              where('status', '==', 'active'),
              orderBy('createdAt', 'asc')
            );
            
            const outstandingCreditsSnap = await getDocs(outstandingCreditsQuery);

            for (const creditDoc of outstandingCreditsSnap.docs) {
                if (paymentRemaining <= 0) break;

                const creditData = creditDoc.data() as LedgerTransaction;
                const creditRef = creditDoc.ref;
                const paidAmount = creditData.paidAmount || 0;
                const remainingOnCredit = creditData.amount - paidAmount;

                if (remainingOnCredit > 0) {
                    const amountToPay = Math.min(paymentRemaining, remainingOnCredit);
                    transaction.update(creditRef, { paidAmount: paidAmount + amountToPay });
                    paymentRemaining -= amountToPay;
                }
            }
        }

        transaction.set(docRef, {
          ...transactionData,
          status: 'active',
          createdAt: serverTimestamp(),
        });
      }
    });
    return {success: true};
  } catch (error) {
    console.error('Error adding ledger transaction to Firestore: ', error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {
      success: false,
      message: `Could not add transaction: ${message}`,
    };
  }
}

export async function deleteLedgerTransaction(
  id: string
): Promise<{success: boolean; message?: string}> {
  try {
    const transactionRef = doc(db, 'ledger', id);
    
    await runTransaction(db, async (transaction) => {
        const transactionSnap = await transaction.get(transactionRef);
        if (!transactionSnap.exists() || transactionSnap.data().status === 'deleted') {
            throw new Error('Transaction already deleted or does not exist.');
        }

        const txData = transactionSnap.data() as LedgerTransaction;

        // If it was a credit transaction, restore inventory
        if (txData.type === 'credit' && txData.items) {
            for (const item of txData.items) {
                if(item.itemId) {
                    const inventoryRef = doc(db, 'inventory', item.itemId);
                    const inventoryDoc = await transaction.get(inventoryRef);
                    if (inventoryDoc.exists()) {
                        const currentStock = inventoryDoc.data().stock as number;
                        transaction.update(inventoryRef, { stock: currentStock + item.quantity });
                    }
                }
            }
        }
        
        // This is a simplified deletion. A more robust system would also handle
        // rolling back payments if a credit is deleted, but that adds significant complexity.
        // For now, we accept that deleting credits/payments can lead to accounting discrepancies
        // if not done carefully by the user.
        
        transaction.update(transactionRef, {
            status: 'deleted',
            deletedAt: serverTimestamp(),
        });
    });

    return {success: true};
  } catch (error) {
    console.error('Error deleting ledger transaction: ', error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {
      success: false,
      message: `Could not delete transaction: ${message}`,
    };
  }
}

export async function deleteCustomer(
  id: string
): Promise<{success: boolean; message?: string}> {
  try {
    const customerRef = doc(db, 'customers', id);
    const customerSnap = await getDoc(customerRef);
    if (customerSnap.exists() && customerSnap.data().status === 'deleted') {
      return {success: false, message: 'Customer already deleted.'};
    }

    const ledgerQuery = query(
      collection(db, 'ledger'),
      where('customerId', '==', id)
    );
    const ledgerSnapshot = await getDocs(ledgerQuery);

    const balance = ledgerSnapshot.docs.reduce((acc, doc) => {
      const data = doc.data() as LedgerTransaction;
      if (data.status === 'deleted') return acc;
      if (data.type === 'credit') {
          return acc + (data.amount - (data.paidAmount || 0));
      }
      // Note: This balance calculation assumes payments are general and not double-counted.
      // A more robust calculation might be needed if payments can be linked. For deletion check, this is okay.
      return acc - data.amount;
    }, 0);

    const totalCredit = ledgerSnapshot.docs.filter(d => d.data().type === 'credit' && d.data().status !== 'deleted').reduce((acc, doc) => acc + doc.data().amount, 0);
    const totalPaid = ledgerSnapshot.docs.filter(d => d.data().type === 'payment' && d.data().status !== 'deleted').reduce((acc, doc) => acc + doc.data().amount, 0);
    const finalBalance = totalCredit - totalPaid;

    if (finalBalance > 0) {
      return {
        success: false,
        message: `Cannot delete customer with an outstanding balance of ₱${finalBalance.toFixed(2)}.`,
      };
    }

    await runTransaction(db, async (transaction) => {
      ledgerSnapshot.forEach((doc) => {
        transaction.update(doc.ref, {
          status: 'deleted',
          deletedAt: serverTimestamp(),
        });
      });

      transaction.update(customerRef, {
        status: 'deleted',
        deletedAt: serverTimestamp(),
      });
    });

    return {success: true};
  } catch (error) {
    console.error('Error deleting customer and their transactions: ', error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {
      success: false,
      message: `Could not delete customer: ${message}`,
    };
  }
}

// Actions for Wallet
export async function startDay(
  data: { startingCash: number; date?: string }
): Promise<{success: boolean; message?: string}> {
  try {
    const dateString = data.date ? format(new Date(data.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    const docRef = doc(db, 'walletHistory', dateString);
    
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        success: false,
        message: 'A session for this date has already been recorded.',
      };
    }

    await setDoc(docRef, {
      date: dateString,
      startingCash: data.startingCash,
      endingCash: null,
      status: 'open',
      createdAt: serverTimestamp(),
      closedAt: null,
    });

    return {success: true};
  } catch (error) {
    console.error('Error starting day:', error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {success: false, message: `Could not start day: ${message}`};
  }
}

export async function closeDay(
  docId: string,
  endingCash: number
): Promise<{success: boolean; message?: string}> {
  try {
    const docRef = doc(db, 'walletHistory', docId);
    await updateDoc(docRef, {
      endingCash,
      status: 'closed',
      closedAt: serverTimestamp(),
    });
    return {success: true};
  } catch (error) {
    console.error('Error closing day:', error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {success: false, message: `Could not close day: ${message}`};
  }
}
