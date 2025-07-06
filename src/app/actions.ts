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

// Helper to escape text for Telegram's MarkdownV2 format
function escapeMarkdownV2(text: string): string {
  // Characters to escape: _ * [ ] ( ) ~ ` > # + - = | { } . !
  const charsToEscape = /[_*[\]()~`>#+\-=|{}.!]/g;
  return text.replace(charsToEscape, '\\$&');
}

// Helper to convert data URI to a Blob, compatible with Edge runtime
function dataURItoBlob(dataURI: string): Blob {
  const [header, base64Data] = dataURI.split(',');
  if (!header || !base64Data) {
    throw new Error('Invalid Data URI');
  }
  const mimeString = header.split(':')[1].split(';')[0];
  const byteString = atob(base64Data);
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);
  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i);
  }
  return new Blob([uint8Array], {type: mimeString});
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

    if (photoDataUri) {
      // Send with photo
      const blob = dataURItoBlob(photoDataUri);
      const formData = new FormData();
      formData.append('chat_id', CHANNEL_ID);
      formData.append('photo', blob, 'receipt.jpg');
      formData.append('caption', caption);
      formData.append('parse_mode', parseMode);
      const response = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
        {method: 'POST', body: formData}
      );
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to send message to Telegram:', errorData);
        const description =
          errorData.description || 'Telegram API returned an error.';
        return {success: false, message: description};
      }
    } else {
      // Send text only
      const response = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            chat_id: CHANNEL_ID,
            text: caption,
            parse_mode: parseMode,
          }),
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to send message to Telegram:', errorData);
        const description =
          errorData.description || 'Telegram API returned an error.';
        return {success: false, message: description};
      }
    }
    return {success: true};
  } catch (error) {
    console.error('Error sending notification to Telegram:', error);
    return {success: false, message: 'Failed to send to Telegram.'};
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
