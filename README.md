
# RiSoCa: The All-in-One Sari-Sari Store POS

RiSoCa is a comprehensive, modern Point of Sale (POS) Progressive Web App (PWA) designed specifically for sari-sari stores and small retail businesses. Built with Next.js, Firebase, and Genkit AI, it transforms your device into a powerful tool for managing sales, inventory, expenses, customer credit, and daily finances in a single, intuitive interface.

The application is designed to be installed on your desktop or mobile device for quick, offline-capable access, providing a seamless, native-app-like experience.

<br/>

![Application Screenshot](https://placehold.co/1200x675.png?text=RiSoCa+App+Showcase)
*<p align="center" data-ai-hint="app dashboard">A placeholder for a beautiful showcase of the app's dashboard.</p>*

<br/>

## Core Features

### 🏪 Point of Sale (POS)
- **Record Sales:** A fast, intuitive interface for adding items to a sale.
- **Dynamic Cart:** Add items from your existing inventory or create new, on-the-fly items directly from the sales screen.
- **Customer Tagging:** Optionally associate a sale with a customer name.
- **Change Calculator:** Automatically calculate change for cash transactions.
- **Printable Receipts:** Generate and print thermal-style receipts for customers.
- **Void Transactions:** Easily void a sale, which automatically restores the item quantities to your inventory.

### 📦 Inventory Management
- **Centralized Product List:** Add, edit, and delete products, including their name, cost, price, and stock quantity.
- **Automatic Stock-Keeping:** Inventory levels are automatically updated when you make a sale or void a transaction.
- **Search & Sort:** Quickly find products in your inventory with search and sorting capabilities.

### 💸 Expense Tracking
- **AI-Powered Receipt Scanning:** Use your device's camera or upload an image to let AI automatically extract the merchant, date, items, total, and category from a receipt.
- **Manual Entry:** Full support for manually entering expense details.
- **Dual Payment Source:** Specify whether an expense was paid from your **Cash on Hand** or from your **G-Cash** balance for precise financial tracking.

### 💳 Credit Ledger (Utang)
- **Customer Accounts:** Manage a list of customers who can make purchases on credit.
- **Credit & Payment Tracking:** Record credit transactions (which deplete inventory) and subsequent payments.
- **Balance Monitoring:** See a clear, real-time outstanding balance for every customer.
- **Detailed History:** View a complete, itemized transaction history for each customer.

### 💰 Daily Wallet & Financials
- **Daily Sessions:** Formally "Start" and "Close" your business day by recording your starting and ending cash.
- **Cash on Hand Tracking:** Your physical cash is tracked separately, ensuring your daily earnings are accurate.
- **G-Cash Services:** Record G-Cash Cash-In, Cash-Out, and E-Load transactions, with automatic fee calculations.
- **Unified Transaction History:** View a single, chronological feed of all activities—sales, expenses, and credit payments.
- **Performance Dashboard:** The homepage provides a high-level overview of Total Sales, Total Expenses, Cash on Hand, and G-Cash Balance, along with performance charts.

### 🔐 Security & Access
- **Password Protection:** The entire application is secured by a site-wide password.
- **Passkey/Fingerprint Login:** After the first password login, register your device to use its built-in fingerprint or face scanner for quick, secure, and convenient access.

## Tech Stack

- **Framework:** Next.js (App Router) & React
- **UI:** ShadCN UI & Tailwind CSS
- **Database:** Firebase Firestore (Real-time)
- **AI:** Google's Gemini model via Genkit
- **PWA:** Enabled with `@ducanh2912/next-pwa` for an installable, offline-first experience.
- **Authentication:** Password and Passkey (WebAuthn)

## Getting Started

### Prerequisites

*   Node.js (v18 or later) and npm
*   A Google AI API Key (from [Google AI Studio](https://aistudio.google.com/)).
*   A Firebase project with Firestore enabled.
*   (Optional) A Telegram Bot Token and Channel ID for receipt notifications.

### 1. Set Up Firebase

1.  **Create Project:** Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2.  **Create Web App:** In your project, go to **Project Settings** > **General**. Under "Your apps," click the Web icon (`</>`), register your app, and copy the `firebaseConfig` object.
3.  **Enable Firestore:** Go to the **Firestore Database** section, click "Create database," and start in **production mode**.
4.  **Set Firestore Rules:** To avoid permission errors, you **must** update your security rules. Go to the **Firestore Database** > **Rules** tab, delete all existing text, and replace it with the following:
    ```
    rules_version = '2';
    service cloud.firestore {
      match /databases/{database}/documents {
        // Allows the app to read and write to all collections.
        // For production, you may want to refine these rules further.
        match /{document=**} {
          allow read, write: if true;
        }
      }
    }
    ```
    Click **Publish**.

### 2. Local Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd <repo-name>
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Create Environment File:**
    Create a file named `.env` in the root of your project and add your keys. Use the `firebaseConfig` values you copied earlier.

    ```env
    # Google AI Key
    GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY

    # Firebase Configuration
    NEXT_PUBLIC_FIREBASE_API_KEY=FROM_FIREBASE_CONFIG
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=FROM_FIREBASE_CONFIG
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=FROM_FIREBASE_CONFIG
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=FROM_FIREBASE_CONFIG
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=FROM_FIREBASE_CONFIG
    NEXT_PUBLIC_FIREBASE_APP_ID=FROM_FIREBASE_CONFIG
    
    # Password for the site
    SITE_PASSWORD=YOUR_CHOSEN_PASSWORD

    # --- Passkey Authentication (REQUIRED) ---
    # These MUST match your app's domain. For local development, use localhost.
    # For a live site like "www.risoca.app", RP_ID must be "risoca.app".
    RP_ID=localhost
    # For a live site, RP_ORIGIN must be "https://www.risoca.app".
    RP_ORIGIN=http://localhost:9002

    # --- Optional: Telegram Notifications ---
    TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
    TELEGRAM_CHANNEL_ID=YOUR_TELEGRAM_CHANNEL_ID
    ```

4.  **Run the development server:**
    ```bash
    npm run dev
    ```
    Open [http://localhost:9002](http://localhost:9002) to see your app.

## Deployment

This application is optimized for deployment on platforms like Vercel or Netlify.

### Deploying to Vercel

1.  **Push to GitHub:** Push your code to a new GitHub repository.
2.  **Import to Vercel:** Import your repository into Vercel.
3.  **Configure Environment Variables:** In your Vercel project settings (under "Environment Variables"), add all the variables from your `.env` file.
4.  **Update Passkey Domain:** **Crucially**, you must update `RP_ID` and `RP_ORIGIN` to match your production domain. For example, if your site is `www.risoca.app`, set:
    -   `RP_ID` to `risoca.app`
    -   `RP_ORIGIN` to `https://www.risoca.app`
5.  **Deploy:** Vercel will automatically build and deploy your application.

Once deployed, you can access the web app and use the "Install" feature in your browser to add it to your devices.
