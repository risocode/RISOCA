"use client";

import { Bot, Rss } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center p-8 bg-white shadow-lg rounded-xl max-w-md mx-auto">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
          <Bot className="h-6 w-6 text-green-600" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">
          Telegram Receipt Bot is Running
        </h1>
        <p className="mt-2 text-gray-600">
          This web page confirms that the server for the Telegram bot is active.
        </p>
        <div className="mt-6 text-left text-sm text-gray-500 space-y-4">
          <p>
            To use the bot, send a photo of a receipt directly to the bot in Telegram.
          </p>
          <p className="flex items-start gap-3">
            <Rss className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
            <span>
              The processed receipt details will be automatically posted to the configured Telegram channel.
            </span>
          </p>
        </div>
         <div className="mt-6 pt-4 border-t border-gray-200 text-xs text-gray-400">
            Make sure your `.env` file is configured and the webhook is set correctly.
        </div>
      </div>
    </div>
  );
}
