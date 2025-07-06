
# AI Receipt Scanner Telegram Bot

This is a Next.js application that powers a Telegram bot to analyze receipts using AI. You send it a photo of a receipt, and it posts the extracted merchant name, date, items, and total to a specified Telegram channel.

## How It Works

The application uses a webhook to receive updates from Telegram. When a user sends a photo to the bot, Telegram forwards the message to an API endpoint in this Next.js app (`/api/telegram`).

The app then:
1.  Downloads the photo from Telegram's servers.
2.  Uses Genkit and Google's Gemini model to analyze the image and extract structured data.
3.  Formats the extracted data into a message.
4.  Sends that message to a pre-configured Telegram channel.

## Getting Started

### Prerequisites

*   Node.js and npm
*   A Telegram account
*   A Vercel account (for deployment)
*   A GitHub account

### 1. Set Up Your Telegram Bot and Channel

1.  **Create a Bot:** Open Telegram and chat with the **BotFather**.
    *   Use the `/newbot` command to create a new bot.
    *   Give it a name and a username.
    *   BotFather will give you an **API Token**. Save this token.

2.  **Create a Channel:**
    *   Create a new channel in Telegram (it can be public or private).
    *   Add your newly created bot to the channel as an **administrator**.
    *   Find your channel's ID. You can use a bot like `@RawDataBot` or `@userinfobot` to get it. For channels, the ID will be a negative number, usually starting with `-100...`.

### 2. Configure Environment Variables

Create a file named `.env` in the root of your project and add your bot token and channel ID:

```
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_FROM_BOTFATHER
TELEGRAM_CHANNEL_ID=YOUR_CHANNEL_ID
```

### 3. Install Dependencies and Run Locally

```bash
npm install
npm run dev
```

The app will be running, but the bot won't work until you deploy it and set up the webhook.

## Deployment to Vercel

1.  **Push to GitHub:** Create a repository on GitHub and push your code to it.

2.  **Import to Vercel:**
    *   Log in to your Vercel account.
    *   Click **Add New...** > **Project**.
    *   Import your repository from GitHub.

3.  **Configure Environment Variables:**
    *   In the Vercel project settings, navigate to the **Environment Variables** section.
    *   Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHANNEL_ID` with the values you saved earlier. This is crucial for the deployed app to work.

4.  **Deploy:** Click the **Deploy** button. Vercel will build and deploy your application, giving you a public URL (e.g., `https://your-project-name.vercel.app`).

### 4. Set the Webhook

This is the final, one-time step to connect your bot to your deployed application. Run the following command in your terminal, replacing the placeholders with your **actual bot token and Vercel URL**.

```bash
curl -F "url=https://YOUR_APP_URL.vercel.app/api/telegram" https://api.telegram.org/botYOUR_TELEGRAM_BOT_TOKEN/setWebhook
```

If it's successful, you'll see a response like: `{"ok":true,"result":true,"description":"Webhook was set"}`.

Your bot is now live! Send it a photo of a receipt to test it out.
