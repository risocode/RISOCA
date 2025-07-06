"use client";

import { useState, useRef, type ChangeEvent, type DragEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UploadCloud, Loader2, FileWarning, ReceiptText, RefreshCw } from "lucide-react";
import type { DiagnoseReceiptOutput } from "@/ai/flows/diagnose-receipt-flow";
import { diagnoseReceipt } from "@/ai/flows/diagnose-receipt-flow";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

type AppState = "initial" | "loading" | "result" | "error";

export default function Home() {
  const [appState, setAppState] = useState<AppState>("initial");
  const [receiptData, setReceiptData] = useState<DiagnoseReceiptOutput | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (file: File | null) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        variant: "destructive",
        title: "Invalid File Type",
        description: "Please upload an image file (e.g., PNG, JPG, WEBP).",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImageDataUrl(dataUrl);
      handleSubmit(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFileChange(e.target.files?.[0] ?? null);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleFileChange(e.dataTransfer.files?.[0] ?? null);
  };

  const handleSubmit = async (dataUrl: string) => {
    setAppState("loading");
    try {
      const result = await diagnoseReceipt({ photoDataUri: dataUrl });
      if (!result || !result.merchantName) {
        throw new Error("Could not analyze receipt. Please try another image.");
      }
      setReceiptData(result);
      setAppState("result");
    } catch (error) {
      console.error(error);
      setAppState("error");
    }
  };

  const handleReset = () => {
    setAppState("initial");
    setReceiptData(null);
    setImageDataUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-secondary/30">
      <header className="w-full p-4 sm:p-6 flex items-center gap-3 border-b bg-background">
        <div className="p-2 bg-primary/20 rounded-lg">
          <ReceiptText className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground">AI Receipt Scanner</h1>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center p-4">
        {appState === "initial" && <InitialView onFileChange={onFileChange} onDrop={onDrop} onDragOver={onDragOver} fileInputRef={fileInputRef} />}
        {appState === "loading" && <LoadingView />}
        {appState === "result" && receiptData && imageDataUrl && <ResultView data={receiptData} imageUrl={imageDataUrl} onReset={handleReset} />}
        {appState === "error" && <ErrorView onReset={handleReset} />}
      </main>
    </div>
  );
}

const InitialView = ({ onFileChange, onDrop, onDragOver, fileInputRef }: { onFileChange: (e: ChangeEvent<HTMLInputElement>) => void, onDrop: (e: DragEvent<HTMLDivElement>) => void, onDragOver: (e: DragEvent<HTMLDivElement>) => void, fileInputRef: React.RefObject<HTMLInputElement> }) => (
  <Card
    className="w-full max-w-lg shadow-lg rounded-2xl cursor-pointer"
    onClick={() => fileInputRef.current?.click()}
    onDragOver={onDragOver}
    onDrop={onDrop}
  >
    <CardContent className="flex flex-col items-center justify-center p-10 sm:p-16 gap-6 text-center">
      <div className="p-6 bg-primary/10 rounded-full border-8 border-primary/5">
        <UploadCloud className="h-16 w-16 text-primary" />
      </div>
      <CardTitle className="text-2xl font-bold">Upload Your Receipt</CardTitle>
      <CardDescription className="text-muted-foreground">
        Drag and drop an image file here or click to select one.
      </CardDescription>
      <Input type="file" accept="image/*" onChange={onFileChange} ref={fileInputRef} className="hidden" />
    </CardContent>
  </Card>
);

const LoadingView = () => (
  <Card className="w-full max-w-lg shadow-xl rounded-2xl border-none bg-transparent">
    <CardContent className="flex flex-col items-center justify-center p-8 sm:p-12 gap-6">
      <Loader2 className="h-20 w-20 animate-spin text-primary" />
      <div className="text-center">
        <CardTitle className="text-2xl font-bold">Analyzing Receipt...</CardTitle>
        <CardDescription className="mt-2 text-muted-foreground">
          Our AI is hard at work extracting the details. Please wait a moment.
        </CardDescription>
      </div>
    </CardContent>
  </Card>
);

const ResultView = ({ data, imageUrl, onReset }: { data: DiagnoseReceiptOutput, imageUrl: string, onReset: () => void }) => (
  <div className="w-full max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
    <div className="space-y-6">
      <Card className="shadow-lg rounded-2xl overflow-hidden">
        <CardHeader>
          <CardTitle>Scanned Receipt</CardTitle>
        </CardHeader>
        <CardContent>
          <Image
            src={imageUrl}
            alt="Uploaded Receipt"
            width={600}
            height={800}
            className="rounded-lg w-full h-auto object-contain"
            data-ai-hint="receipt scan"
          />
        </CardContent>
      </Card>
      <Button onClick={onReset} className="w-full" variant="outline">
        <RefreshCw className="mr-2 h-4 w-4" />
        Scan Another Receipt
      </Button>
    </div>
    <div className="space-y-6">
      <Card className="shadow-lg rounded-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">{data.merchantName}</CardTitle>
          <CardDescription>
            {new Date(data.transactionDate + 'T00:00:00').toLocaleDateString(undefined, {
              year: 'numeric', month: 'long', day: 'numeric',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-right">${item.price.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-6 pt-4 border-t-2 border-dashed flex justify-between items-center font-bold text-xl">
            <span>Total</span>
            <span>${data.total.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
);

const ErrorView = ({ onReset }: { onReset: () => void }) => (
  <Card className="w-full max-w-lg shadow-xl rounded-2xl">
    <CardContent className="flex flex-col items-center justify-center p-8 sm:p-12 gap-6 text-center">
      <div className="p-4 bg-destructive/10 rounded-full">
        <FileWarning className="h-16 w-16 text-destructive" />
      </div>
      <CardTitle className="text-2xl font-bold">Analysis Failed</CardTitle>
      <CardDescription className="text-muted-foreground">
        We couldn't extract data from the receipt. The image might be blurry or unsupported.
      </CardDescription>
      <Button onClick={onReset} variant="destructive">
        <RefreshCw className="mr-2 h-4 w-4" />
        Try Again
      </Button>
    </CardContent>
  </Card>
);
