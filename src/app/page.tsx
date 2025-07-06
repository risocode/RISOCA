"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, Loader2, ReceiptText } from "lucide-react";

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <header className="absolute top-0 left-0 w-full p-4 sm:p-6 flex items-center gap-3">
        <div className="p-2 bg-primary/20 rounded-lg">
          <ReceiptText className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground">RiSoCa Receipt</h1>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl rounded-2xl border-none">
          <CardContent className="flex flex-col items-center justify-center p-8 sm:p-12 gap-6">
            {isLoading ? (
              <>
                <Loader2 className="h-20 w-20 animate-spin text-primary" />
                <div className="text-center">
                  <CardTitle className="text-2xl font-bold">Uploading Receipt...</CardTitle>
                  <CardDescription className="mt-2 text-muted-foreground">
                    Please wait a moment while we process your receipt.
                  </CardDescription>
                </div>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-20 w-20 text-accent" />
                <div className="text-center">
                  <CardTitle className="text-2xl font-bold">Receipt Received!</CardTitle>
                  <CardDescription className="mt-2 text-muted-foreground">
                    Your receipt has been successfully uploaded. You can now safely close this window.
                  </CardDescription>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
