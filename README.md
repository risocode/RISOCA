
# RiSoCa Bot

This is a Next.js Progressive Web App (PWA) that lets you scan receipts using AI. Upload a photo of a receipt, and it will use Google's Gemini model to extract the merchant name, date, items, and total amount.

This app is designed to be installed on your desktop (via Chrome) or mobile device for a native-like experience. As a bonus feature, after each successful scan, the receipt details and image are automatically sent to a designated Telegram channel.

## Features

*   **AI-Powered Scanning:** Uses Genkit and the Gemini AI model to accurately parse receipt data.
*   **Telegram Integration:** Automatically sends scanned receipt details and images to a Telegram channel.
*   **PWA Ready:** Installable on desktop and mobile devices for quick access.
*   **Dashboard:** View a history of your scanned receipts and see a summary of your spending for the session. Data is persisted in your browser's local storage.
*   **Dual Input:** Upload a receipt image or use your device's camera to capture one directly.
*   **Responsive UI:** A clean, modern interface built with Next.js, ShadCN UI, and Tailwind CSS.

## Getting Started

### Prerequisites

*   Node.js and npm
*   A Google AI API Key (you can get one from [Google AI Studio](https://aistudio.google.com/)).
*   A Telegram Bot Token from BotFather.
*   A Telegram Channel ID where the bot will post messages.

### Installation and Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd <your-repo-name>
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up your environment variables:**
    Create a file named `.env` in the root of your project and add the following keys. The Google AI key should be for a project with the "Generative Language API" enabled. To get a Telegram Channel ID, create a channel, add your bot as an administrator, and then use a helper bot like `@userinfobot` to get the channel's ID (it usually starts with `-100...`).

    ```
    GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY
    TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
    TELEGRAM_CHANNEL_ID=YOUR_TELEGRAM_CHANNEL_ID
    ```

4.  **Run the development server:**
    ```bash
    npm run dev
    ```

    Open [http://localhost:9002](http://localhost:9002) with your browser to see the result.

## Deployment

This application is ready to be deployed to any static hosting provider like Vercel, Netlify, or Firebase Hosting.

### Deploying to Vercel

1.  **Push to GitHub:** Create a repository on GitHub and push your code to it.
2.  **Import to Vercel:** Import your repository into Vercel.
3.  **Configure Environment Variables:** In the Vercel project settings, add your `GOOGLE_API_KEY`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_CHANNEL_ID` as environment variables.
4.  **Deploy:** Click the **Deploy** button.

Once deployed, you can access the web app from your browser and use the "Install" feature in Chrome to add it to your device.
