import {NextRequest, NextResponse} from 'next/server';
import TelegramBot from 'node-telegram-bot-api';
import {diagnoseReceipt} from '@/ai/flows/diagnose-receipt-flow';

const token = process.env.TELEGRAM_BOT_TOKEN;
const channelId = process.env.TELEGRAM_CHANNEL_ID;

let bot: TelegramBot;
if (token) {
  bot = new TelegramBot(token);
}

export async function POST(req: NextRequest) {
  if (!token || !channelId) {
    console.error('Telegram token or channel ID not configured in .env file.');
    return NextResponse.json({error: 'Bot not configured'}, {status: 500});
  }

  try {
    const body = await req.json();
    const message = body.message;

    if (message && message.photo) {
      const photo = message.photo[message.photo.length - 1];
      const fileId = photo.file_id;

      const file = await bot.getFile(fileId);
      const filePath = file.file_path;
      const fileUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;

      const imageResponse = await fetch(fileUrl);
      if (!imageResponse.ok) {
        throw new Error('Failed to download image from Telegram');
      }
      const imageBuffer = await imageResponse.arrayBuffer();
      const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';
      const photoDataUri = `data:${mimeType};base64,${Buffer.from(imageBuffer).toString('base64')}`;

      const diagnosis = await diagnoseReceipt({photoDataUri});

      let messageText = `🧾 *Receipt Processed*\n\n`;
      messageText += `*Merchant:* ${diagnosis.merchantName}\n`;
      messageText += `*Date:* ${new Date(diagnosis.transactionDate + 'T00:00:00').toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric',
      })}\n\n`;
      messageText += `*Items:*\n`;
      diagnosis.items.forEach(item => {
        messageText += `• ${item.name}: $${item.price.toFixed(2)}\n`;
      });
      messageText += `\n*Total: \$${diagnosis.total.toFixed(2)}*`;

      const originalMessageLink = `https://t.me/c/${message.chat.id}/${message.message_id}`;

      await bot.sendMessage(channelId, messageText, {parse_mode: 'Markdown'});
    } else if (message && message.text) {
      const chatId = message.chat.id;
      await bot.sendMessage(chatId, "Hello! To use this bot, please send me a photo of a receipt. I will analyze it and post the details to our channel.");
    }

    return NextResponse.json({status: 'ok'});
  } catch (error) {
    console.error('Error processing Telegram update:', error);
    if (error instanceof Error && channelId) {
      try {
        await bot.sendMessage(channelId, `An error occurred while processing a receipt: ${error.message}`);
      } catch (sendError) {
        console.error('Failed to send error message to Telegram:', sendError);
      }
    }
    return NextResponse.json({error: 'Internal server error'}, {status: 500});
  }
}
