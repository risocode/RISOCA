
# AI Receipt Scanner Web App

This is a Next.js Progressive Web App (PWA) that lets you scan receipts using AI. Upload a photo of a receipt, and it will use Google's Gemini model to extract the merchant name, date, items, and total amount.

This app is designed to be installed on your desktop (via Chrome) or mobile device for a native-like experience.

## Features

*   **AI-Powered Scanning:** Uses Genkit and the Gemini AI model to accurately parse receipt data.
*   **PWA Ready:** Installable on desktop and mobile devices for quick access.
*   **Responsive UI:** A clean, modern interface built with Next.js, ShadCN UI, and Tailwind CSS.
*   **Image Previews:** See the receipt you've uploaded before sending it for analysis.

## Getting Started

### Prerequisites

*   Node.js and npm
*   A Google AI API Key (you can get one from [Google AI Studio](https://aistudio.google.com/)).

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
    Create a file named `.env` in the root of your project and add your Google AI API key. The key should be for a project with the "Generative Language API" enabled.
    ```
    GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY
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
3.  **Configure Environment Variables:** In the Vercel project settings, add your `GOOGLE_API_KEY` as an environment variable.
4.  **Deploy:** Click the **Deploy** button.

Once deployed, you can access the web app from your browser and use the "Install" feature in Chrome to add it to your device.
