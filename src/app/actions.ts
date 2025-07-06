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
  runTransaction,
  serverTimestamp,
  updateDoc,
  type DocumentReference,
  type Timestamp,
} from 'firebase/firestore';
import type {InventoryItemInput} from '@/lib/schemas';

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

  try {
    const caption = [
      `🧾 *Receipt Processed* 🧾`,
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
      `*Total:* ${escapeMarkdownV2(diagnosis.total.toFixed(2))}`,
      ``,
      `*Items:*`,
      ...diagnosis.items.map(
        (item) =>
          `\\- ${escapeMarkdownV2(item.name)}: ${escapeMarkdownV2(
            item.price.toFixed(2)
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

// Types for Sales Report
export type SaleItem = {
  itemId?: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type SalesReportInput = {
  items: SaleItem[];
};

// Action to submit a sales report
export async function submitSalesReport(
  report: SalesReportInput
): Promise<{success: boolean; message?: string}> {
  if (!report.items || report.items.length === 0) {
    return {success: false, message: 'No items in the report.'};
  }

  try {
    await runTransaction(db, async (transaction) => {
      const inventoryCollection = collection(db, 'inventory');

      // Create a map of inventory items to fetch to avoid duplicate reads
      const inventoryToFetch = new Map<
        string,
        {itemRef: DocumentReference; quantity: number}
      >();
      for (const item of report.items) {
        if (item.itemId) {
          const existing = inventoryToFetch.get(item.itemId);
          inventoryToFetch.set(item.itemId, {
            itemRef: doc(inventoryCollection, item.itemId),
            quantity: (existing?.quantity || 0) + item.quantity,
          });
        }
      }

      // Read all necessary inventory documents
      const itemRefs = Array.from(inventoryToFetch.values()).map(
        (i) => i.itemRef
      );

      const inventoryDocPromises = itemRefs.map((itemRef) =>
        transaction.get(itemRef)
      );
      const inventoryDocs = await Promise.all(inventoryDocPromises);

      // Validate stock and prepare updates
      for (const inventoryDoc of inventoryDocs) {
        if (!inventoryDoc.exists()) {
          const failedItem = report.items.find(
            (i) => i.itemId === inventoryDoc.id
          );
          throw new Error(
            `Item "${failedItem?.itemName}" with ID ${inventoryDoc.id} not found in inventory.`
          );
        }

        const required = inventoryToFetch.get(inventoryDoc.id)!;
        const currentStock = inventoryDoc.data().stock as number;

        if (currentStock < required.quantity) {
          throw new Error(
            `Insufficient stock for "${inventoryDoc.data().name}". Available: ${currentStock}, Requested: ${required.quantity}.`
          );
        }

        // Prepare the stock update
        transaction.update(inventoryDoc.ref, {
          stock: currentStock - required.quantity,
        });
      }

      // Record all sales
      for (const item of report.items) {
        const {itemId, ...saleData} = item;
        transaction.set(doc(collection(db, 'sales')), {
          ...saleData,
          createdAt: serverTimestamp(),
        });
      }
    });

    return {success: true};
  } catch (error) {
    console.error('Error in sales report transaction: ', error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {
      success: false,
      message: `Transaction failed: ${message}`,
    };
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
  item: InventoryItemInput
): Promise<{success: boolean; message?: string}> {
  try {
    const itemRef = doc(db, 'inventory', id);
    await updateDoc(itemRef, {
      ...item,
    });
    return {success: true};
  } catch (error)
  {
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

export async function seedInventory(): Promise<{
  success: boolean;
  message?: string;
}> {
  const sampleItems: InventoryItemInput[] = [
    {name: 'Lucky Me! Pancit Canton Chilimansi', price: 15.5, stock: 100},
    {name: 'Coca-Cola Sakto 200ml', price: 12.0, stock: 50},
    {name: 'Bear Brand Fortified 150g', price: 75.0, stock: 30},
    {name: 'Kopiko Brown Coffee Twin Pack', price: 10.0, stock: 200},
    {name: 'Silver Swan Soy Sauce 200ml', price: 20.0, stock: 40},
    {name: 'Nissin Cup Noodles - Beef', price: 35.0, stock: 60},
    {name: 'C2 Green Tea Apple 500ml', price: 28.0, stock: 45},
    {name: 'Piattos - Cheese 85g', price: 45.0, stock: 70},
    {name: 'Century Tuna Flakes in Oil 155g', price: 42.5, stock: 80},
    {name: 'UFC Banana Ketchup 320g', price: 30.0, stock: 55},
  ];

  try {
    const inventoryCollection = collection(db, 'inventory');

    const addPromises = sampleItems.map((item) =>
      addDoc(inventoryCollection, {
        ...item,
        createdAt: serverTimestamp(),
      })
    );

    await Promise.all(addPromises);

    return {
      success: true,
      message: `${sampleItems.length} sample items added.`,
    };
  } catch (error) {
    console.error('Error seeding inventory:', error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {success: false, message: `Could not seed inventory: ${message}`};
  }
}
