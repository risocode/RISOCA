
# RiSoCa Store

This is a Next.js Progressive Web App (PWA) that lets you scan receipts using AI. Upload a photo of a receipt, and it will use Google's Gemini model to extract the merchant name, date, items, and total amount.

This app is designed to be installed on your desktop (via Chrome) or mobile device for a native-like experience. As a bonus feature, after each successful scan, the receipt details and image are automatically sent to a designated Telegram channel.

## Features

*   **AI-Powered Scanning:** Uses Genkit and the Gemini AI model to accurately parse receipt data.
*   **Firebase Integration:** All scanned receipts are saved to a central Firestore database, ensuring your data is persistent and secure.
*   **Telegram Integration:** Automatically sends scanned receipt details and images to a Telegram channel.
*   **PWA Ready:** Installable on desktop and mobile devices for quick access.
*   **Dashboard:** View a history of your scanned receipts and see a summary of your spending. Data is loaded in real-time from Firestore.
*   **Triple Input:** Upload an image, use your device's camera, or enter receipt details manually.
*   **Responsive UI:** A clean, modern interface built with Next.js, ShadCN UI, and Tailwind CSS.
*   **Passwordless Security:** Secure your application with an initial password, then add Passkeys (fingerprint, face ID, hardware keys) for quick and secure access.

## Getting Started

### Prerequisites

*   Node.js and npm
*   A Google AI API Key (from [Google AI Studio](https://aistudio.google.com/)).
*   A Telegram Bot Token (from BotFather).
*   A Telegram Channel ID.
*   A Firebase project with Firestore enabled.

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

3.  **Set up Firebase:**
    *   Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
    *   In your project, go to **Project Settings** (click the gear icon).
    *   Under the "General" tab, scroll down to "Your apps" and click the **Web** icon (`</>`).
    *   Give your app a nickname and click "Register app".
    *   You'll see an `firebaseConfig` object. Copy the key-value pairs. You will need these for your environment variables.
    *   In the Firebase console, go to the **Firestore Database** section, click "Create database", and start in **production mode**. Choose a location and click "Enable".

4.  **Set Up Firestore Security Rules (IMPORTANT FIX for "permission-denied" errors):**
    When you create a Firestore database in "production mode," it is locked down by default. To fix the `permission-denied` error, you must set the correct rules.

    *   In the Firebase Console, go to the **Firestore Database** section.
    *   Click on the **Rules** tab.
    *   **Delete all existing text** in the editor and replace it with the following rules. This version explicitly grants access to each collection your app uses.

    ```
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        // Allows access to specific collections used by the app.
        match /receipts/{document=**} {
          allow read, write: if true;
        }
        match /saleTransactions/{document=**} {
          allow read, write: if true;
        }
        match /inventory/{document=**} {
          allow read, write: if true;
        }
        match /customers/{document=**} {
          allow read, write: if true;
        }
        match /ledger/{document=**} {
          allow read, write: if true;
        }
        match /walletHistory/{document=**} {
          allow read, write: if true;
        }
        match /counters/{document=**} {
          allow read, write: if true;
        }
        // Added for Passkey/WebAuthn functionality
        match /challenges/{document=**} {
          allow read, write: if true;
        }
        match /authenticators/{document=**} {
          allow read, write: if true;
        }
      }
    }
    ```
    *   Click **Publish**. The permission errors should be resolved immediately.

5.  **Set up your environment variables:**
    Create a file named `.env` in the root of your project and add your keys.

    ```
    # Google AI Key
    GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY

    # Telegram Bot
    TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
    TELEGRAM_CHANNEL_ID=YOUR_TELEGRAM_CHANNEL_ID

    # Firebase Configuration
    NEXT_PUBLIC_FIREBASE_API_KEY=FROM_FIREBASE_CONFIG
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=FROM_FIREBASE_CONFIG
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=FROM_FIREBASE_CONFIG
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=FROM_FIREBASE_CONFIG
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=FROM_FIREBASE_CONFIG
    NEXT_PUBLIC_FIREBASE_APP_ID=FROM_FIREBASE_CONFIG
    
    # Password & WebAuthn Relying Party
    SITE_PASSWORD=YOUR_CHOSEN_PASSWORD

    # -------------------------------------------------------------
    # Passkey / WebAuthn Configuration
    # These MUST match your website's domain for Passkeys to work.
    # -------------------------------------------------------------
    #
    # RP_ID is the "relying party ID". This should be your site's domain name, without 'www'.
    # e.g., if your site is www.risoca.store, this should be risoca.store
    #
    # RP_ORIGIN is the full URL, including the protocol (http:// or https://) where the app is hosted.
    # e.g., https://www.risoca.store
    #
    # --- For local development (testing on your machine) ---
    RP_ID=localhost
    RP_ORIGIN=http://localhost:9002
    ```

6.  **Run the development server:**
    ```bash
    npm run dev
    ```

    Open [http://localhost:9002](http://localhost:9002) with your browser to see the result.

## Deployment

This application is ready to be deployed to any static hosting provider like Vercel, Netlify, or Firebase Hosting.

### Deploying to Vercel

1.  **Push to GitHub:** Create a repository on GitHub and push your code to it.
2.  **Import to Vercel:** Import your repository into Vercel.
3.  **Configure Environment Variables:** In the Vercel project settings, add all the environment variables from your `.env` file.
4.  **CRITICAL: Configure Passkey/WebAuthn Variables for Production:**
    The `RP_ID` and `RP_ORIGIN` variables are **mandatory** for Passkey authentication to work on a live website. You must update them in your Vercel project settings to match your **primary production domain**.
    
    For example, if your site's primary domain is `https://www.risoca.store`:
    *   Set `RP_ID` to `risoca.store` (The registrable domain, without `www` or subdomains)
    *   Set `RP_ORIGIN` to `https://www.risoca.store` (The full URL, including the protocol)
    
    If you have multiple domains (e.g., `www.risoca.store` and the default `risoca-ten.vercel.app`), you should configure your hosting provider to redirect all traffic to your primary domain. Passkeys registered on `www.risoca.store` will not work on `risoca-ten.vercel.app`, and vice-versa, because the browser sees them as different websites.
5.  **Deploy:** Click the **Deploy** button.

Once deployed, you can access the web app from your browser and use the "Install" feature in Chrome to add it to your device.
