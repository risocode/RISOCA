'use server';

import {
  diagnoseReceipt,
  type DiagnoseReceiptInput,
  type DiagnoseReceiptOutput,
} from '@/ai/flows/diagnose-receipt-flow';
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
  type Timestamp,
} from 'firebase/firestore';
import type {
  InventoryItemInput,
  LedgerTransactionInput,
  SaleTransactionInput,
  SaleItem,
} from '@/lib/schemas';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

type NotificationStatus = {
  success: boolean;
  message?: string;
};

export type ActionResponse = {
  diagnosis: DiagnoseReceiptOutput;
  notificationStatus: NotificationStatus;
};

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
  receiptData: DiagnoseReceiptOutput,
  imagePreview?: string
) {
  try {
    await addDoc(collection(db, 'receipts'), {
      ...receiptData,
      imagePreview: imagePreview || null,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error writing document to Firestore: ', error);
    throw new Error('Could not save receipt to database.');
  }
}

export async function scanAndNotify(
  input: DiagnoseReceiptInput
): Promise<ActionResponse> {
  const diagnosis = await diagnoseReceipt(input);
  await saveReceiptToFirestore(diagnosis, input.photoDataUri);
  const notificationStatus = await notifyOnTelegram(
    diagnosis,
    input.photoDataUri
  );
  return {diagnosis, notificationStatus};
}

export async function submitManualReceipt(
  data: DiagnoseReceiptOutput
): Promise<ActionResponse> {
  await saveReceiptToFirestore(data);
  const notificationStatus = await notifyOnTelegram(data);
  return {diagnosis: data, notificationStatus};
}

// Action to submit a sales transaction
export async function submitSaleTransaction(
  saleData: SaleTransactionInput
): Promise<{success: boolean; message?: string; transactionId?: string}> {
  if (!saleData.items || saleData.items.length === 0) {
    return {success: false, message: 'No items in the report.'};
  }

  try {
    let transactionId: string | undefined = undefined;
    await runTransaction(db, async (transaction) => {
      // 1. Create the main transaction document
      const transactionRef = doc(collection(db, 'saleTransactions'));
      transactionId = transactionRef.id;
      transaction.set(transactionRef, {
        ...saleData,
        createdAt: serverTimestamp(),
        status: 'active',
      });

      // 2. Update inventory stock
      const inventoryCollection = collection(db, 'inventory');
      const inventoryToFetch = new Map<
        string,
        {itemRef: DocumentReference; quantity: number}
      >();
      for (const item of saleData.items) {
        if (item.itemId) {
          const existing = inventoryToFetch.get(item.itemId);
          inventoryToFetch.set(item.itemId, {
            itemRef: doc(inventoryCollection, item.itemId),
            quantity: (existing?.quantity || 0) + item.quantity,
          });
        }
      }

      const itemRefs = Array.from(inventoryToFetch.values()).map(
        (i) => i.itemRef
      );

      if (itemRefs.length > 0) {
        const inventoryDocPromises = itemRefs.map((itemRef) =>
          transaction.get(itemRef)
        );
        const inventoryDocs = await Promise.all(inventoryDocPromises);
        for (const inventoryDoc of inventoryDocs) {
          if (!inventoryDoc.exists()) continue;
          const required = inventoryToFetch.get(inventoryDoc.id)!;
          const currentStock = inventoryDoc.data().stock as number;
          if (currentStock < required.quantity) {
            throw new Error(
              `Insufficient stock for "${
                inventoryDoc.data().name
              }". Available: ${currentStock}, Requested: ${required.quantity}.`
            );
          }
          transaction.update(inventoryDoc.ref, {
            stock: currentStock - required.quantity,
          });
        }
      }
    });

    return {success: true, transactionId};
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

// Actions for Inventory
export async function addInventoryItem(
  item: InventoryItemInput
): Promise<{success: boolean; message?: string}> {
  try {
    await addDoc(collection(db, 'inventory'), {
      ...item,
      createdAt: serverTimestamp(),
    });
    return {success: true};
  } catch (error) {
    console.error('Error adding inventory item to Firestore: ', error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {success: false, message: `Could not add item: ${message}`};
  }
}

export async function updateInventoryItem(
  id: string,
  item: Partial<InventoryItemInput>
): Promise<{success: boolean; message?: string}> {
  try {
    const itemRef = doc(db, 'inventory', id);
    await updateDoc(itemRef, item);
    return {success: true};
  } catch (error) {
    console.error('Error updating inventory item in Firestore: ', error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {success: false, message: `Could not update item: ${message}`};
  }
}

export async function deleteInventoryItem(
  id: string
): Promise<{success: boolean; message?: string}> {
  try {
    await deleteDoc(doc(db, 'inventory', id));
    return {success: true};
  } catch (error) {
    console.error('Error deleting inventory item from Firestore: ', error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {success: false, message: `Could not delete item: ${message}`};
  }
}

export async function verifyPassword(
  password: string
): Promise<{success: boolean}> {
  if (!process.env.SITE_PASSWORD) {
    console.error('SITE_PASSWORD environment variable is not set.');
    return {success: false};
  }
  const isCorrect = password === process.env.SITE_PASSWORD;
  return {success: isCorrect};
}

// Actions for Credit Ledger
export async function addCustomer(data: {
  name: string;
  amount: number;
  description?: string;
}): Promise<{success: boolean; message?: string}> {
  try {
    await runTransaction(db, async (transaction) => {
      const customerRef = doc(collection(db, 'customers'));
      transaction.set(customerRef, {
        name: data.name,
        status: 'active',
        createdAt: serverTimestamp(),
      });

      if (data.amount > 0) {
        const ledgerRef = doc(collection(db, 'ledger'));
        transaction.set(ledgerRef, {
          customerId: customerRef.id,
          type: 'credit',
          amount: data.amount,
          description: data.description || 'Initial balance',
          status: 'active',
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

export async function addLedgerTransaction(
  transactionData: LedgerTransactionInput
): Promise<{success: boolean; message?: string}> {
  try {
    await addDoc(collection(db, 'ledger'), {
      ...transactionData,
      status: 'active',
      createdAt: serverTimestamp(),
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
    const transactionSnap = await getDoc(transactionRef);
    if (
      transactionSnap.exists() &&
      transactionSnap.data().status === 'deleted'
    ) {
      return {success: false, message: 'Transaction already deleted.'};
    }
    await updateDoc(transactionRef, {
      status: 'deleted',
      deletedAt: serverTimestamp(),
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
      const data = doc.data();
      if (data.status === 'deleted') return acc;
      return acc + (data.type === 'credit' ? data.amount : -data.amount);
    }, 0);

    if (balance !== 0) {
      return {
        success: false,
        message: 'Cannot delete customer with an outstanding balance.',
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
