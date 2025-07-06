'use server';

import {
  diagnoseReceipt,
  type DiagnoseReceiptInput,
  type DiagnoseReceiptOutput,
} from '@/ai/flows/diagnose-receipt-flow';
import {db} from '@/lib/firebase';
import {addDoc, collection, serverTimestamp} from 'firebase/firestore';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID?.trim();

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
    const salesCollection = collection(db, 'sales');
    for (const item of report.items) {
      await addDoc(salesCollection, {
        ...item,
        createdAt: serverTimestamp(),
      });
    }
    return {success: true};
  } catch (error) {
    console.error('Error writing sales report to Firestore: ', error);
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    return {success: false, message: `Could not save report: ${message}`};
  }
}
