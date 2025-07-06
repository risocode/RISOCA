'use server';

import {
  diagnoseReceipt,
  type DiagnoseReceiptInput,
  type DiagnoseReceiptOutput,
} from '@/ai/flows/diagnose-receipt-flow';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

// Helper to convert data URI to Blob
function dataURItoBlob(dataURI: string) {
  const byteString = atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], {type: mimeString});
}

export async function scanAndNotify(
  input: DiagnoseReceiptInput
): Promise<DiagnoseReceiptOutput> {
  // 1. Diagnose the receipt
  const diagnosis = await diagnoseReceipt(input);

  if (BOT_TOKEN && CHANNEL_ID) {
    try {
      // 2. Format the message for Telegram
      const caption = [
        `🧾 *Receipt Scanned* 🧾`,
        ``,
        `*Merchant:* ${diagnosis.merchantName}`,
        `*Date:* ${new Date(
          diagnosis.transactionDate + 'T00:00:00'
        ).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}`,
        `*Category:* ${diagnosis.category}`,
        `*Total:* ₱${diagnosis.total.toFixed(2)}`,
        ``,
        `*Items:*`,
        ...diagnosis.items.map(
          (item) => `- ${item.name}: ₱${item.price.toFixed(2)}`
        ),
      ].join('\n');

      const blob = dataURItoBlob(input.photoDataUri);
      const formData = new FormData();
      formData.append('chat_id', CHANNEL_ID);
      formData.append('photo', blob, 'receipt.jpg');
      formData.append('caption', caption);
      formData.append('parse_mode', 'Markdown');

      // 3. Send to Telegram channel
      const response = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to send message to Telegram:', errorData);
        // We don't throw an error here, so the frontend still gets the diagnosis
      }
    } catch (error) {
      console.error('Error sending notification to Telegram:', error);
    }
  } else {
    console.warn(
      'Telegram environment variables not set. Skipping channel notifications.'
    );
  }

  // 4. Return diagnosis to the frontend
  return diagnosis;
}
