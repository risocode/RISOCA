'use client';

import {useState, useRef, type ChangeEvent} from 'react';
import Image from 'next/image';
import {
  Upload,
  ReceiptText,
  Bot,
  X,
  ServerCrash,
  LayoutDashboard,
} from 'lucide-react';
import {useRouter} from 'next/navigation';
import {v4 as uuidv4} from 'uuid';
import {
  diagnoseReceipt,
  type DiagnoseReceiptOutput,
} from '@/ai/flows/diagnose-receipt-flow';
import {useReceipts} from '@/contexts/ReceiptContext';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Alert, AlertTitle, AlertDescription} from '@/components/ui/alert';
import {Skeleton} from '@/components/ui/skeleton';
import {Badge} from '@/components/ui/badge';

export default function Home() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [diagnosis, setDiagnosis] = useState<DiagnoseReceiptOutput | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {addReceipt} = useReceipts();
  const router = useRouter();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        // 4MB limit
        setError('File is too large. Please upload an image under 4MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setImagePreview(URL.createObjectURL(file));
        setImageData(dataUrl);
        setError(null);
        setDiagnosis(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScanReceipt = async () => {
    if (!imageData || !imagePreview) {
      setError('Please select an image first.');
      return;
    }
    setIsLoading(true);
    setDiagnosis(null);
    setError(null);

    try {
      const result = await diagnoseReceipt({photoDataUri: imageData});
      setDiagnosis(result);
      addReceipt({
        ...result,
        id: uuidv4(),
        imagePreview: imagePreview,
      });
    } catch (e) {
      console.error(e);
      setError(
        'The AI could not process the receipt. It might be blurry or unsupported. Please try another image.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setImagePreview(null);
    setImageData(null);
    setDiagnosis(null);
    setError(null);
    setIsLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const renderInitialState = () => (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot /> AI Receipt Scanner
        </CardTitle>
        <CardDescription>
          Upload a photo of your receipt to get started.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="relative flex flex-col items-center justify-center w-full p-8 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="text-center">
            <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-muted-foreground">
              PNG, JPG, or WEBP (max 4MB)
            </p>
          </div>
          <Input
            ref={fileInputRef}
            id="receipt-upload"
            type="file"
            className="sr-only"
            accept="image/png, image/jpeg, image/webp"
            onChange={handleFileChange}
          />
        </div>
        {error && (
          <Alert variant="destructive">
            <ServerCrash className="w-4 h-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );

  const renderPreviewState = () => (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Ready to Scan</CardTitle>
        <CardDescription>
          Click the button below to analyze your receipt.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative w-full overflow-hidden rounded-lg aspect-[16/10] border">
          {imagePreview && (
            <Image
              src={imagePreview}
              alt="Receipt preview"
              layout="fill"
              objectFit="contain"
            />
          )}
        </div>
        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={handleReset}>
            <X className="mr-2" /> Cancel
          </Button>
          <Button onClick={handleScanReceipt}>
            <ReceiptText className="mr-2" /> Scan Receipt
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderLoadingState = () => (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Analyzing Receipt</CardTitle>
        <CardDescription>
          The AI is working its magic. Please wait...
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <Skeleton className="w-full rounded-lg aspect-video" />
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="w-1/4 h-4" />
            <Skeleton className="w-2/4 h-6" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="w-1/3 h-4" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="w-1/5 h-8" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="w-full h-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderResultsState = () =>
    diagnosis && (
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Analysis Complete</CardTitle>
          <CardDescription>
            Here's what the AI found on your receipt.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-8 md:grid-cols-2">
          <div className="relative w-full overflow-hidden rounded-lg aspect-[16/10] border">
            {imagePreview && (
              <Image
                src={imagePreview}
                alt="Receipt"
                layout="fill"
                objectFit="contain"
              />
            )}
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Merchant
                </p>
                <p className="text-lg font-semibold">{diagnosis.merchantName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Date</p>
                <p>
                  {new Date(
                    diagnosis.transactionDate + 'T00:00:00'
                  ).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total
                </p>
                <p className="text-2xl font-bold text-primary">
                  ${diagnosis.total.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Category
                </p>
                <Badge variant="outline">{diagnosis.category}</Badge>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Items ({diagnosis.items.length})
              </p>
              <div className="p-3 border rounded-md max-h-48 overflow-y-auto text-sm bg-muted/50">
                <ul className="space-y-2">
                  {diagnosis.items.map((item, index) => (
                    <li
                      key={index}
                      className="flex justify-between py-1 border-b last:border-none"
                    >
                      <span className="pr-2 truncate">{item.name}</span>
                      <span className="flex-shrink-0">
                        ${item.price.toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
        <div className="p-6 pt-0 flex flex-col sm:flex-row gap-2">
          <Button
            onClick={() => router.push('/dashboard')}
            variant="outline"
            className="w-full"
          >
            <LayoutDashboard className="mr-2" /> View Dashboard
          </Button>
          <Button onClick={handleReset} className="w-full">
            <ReceiptText className="mr-2" /> Scan Another
          </Button>
        </div>
      </Card>
    );

  const renderErrorState = () => (
    <Card className="w-full max-w-lg shadow-2xl shadow-destructive/20">
      <CardHeader>
        <CardTitle>Analysis Failed</CardTitle>
        <CardDescription>
          Sorry, we couldn't process your receipt.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <ServerCrash className="w-4 h-4" />
          <AlertTitle>Processing Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="relative w-full overflow-hidden rounded-lg aspect-video opacity-50 border">
          {imagePreview && (
            <Image
              src={imagePreview}
              alt="Receipt with error"
              layout="fill"
              objectFit="contain"
            />
          )}
        </div>
        <Button onClick={handleReset} variant="destructive" className="w-full">
          <Upload className="mr-2" /> Try Again
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <main className="flex flex-col items-center justify-center w-full min-h-full p-4 bg-background">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/20 via-background to-background -z-10"></div>
      <div className="z-10 flex items-center justify-center w-full h-full">
        {isLoading
          ? renderLoadingState()
          : diagnosis
            ? renderResultsState()
            : error && imagePreview
              ? renderErrorState()
              : imagePreview
                ? renderPreviewState()
                : renderInitialState()}
      </div>
    </main>
  );
}
