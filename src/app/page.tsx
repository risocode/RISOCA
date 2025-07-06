'use client';

import {useState, useRef, type ChangeEvent, useEffect} from 'react';
import Image from 'next/image';
import {
  Upload,
  ReceiptText,
  Bot,
  X,
  ServerCrash,
  LayoutDashboard,
  Camera,
  XCircle,
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
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';

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

  const [inputMethod, setInputMethod] = useState<'upload' | 'camera'>(
    'upload'
  );
  const [hasCameraPermission, setHasCameraPermission] = useState<
    boolean | null
  >(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (inputMethod === 'camera' && !imagePreview) {
      const getCameraPermission = async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {facingMode: 'environment'},
          });
          setHasCameraPermission(true);

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (error) {
          console.error('Error accessing camera:', error);
          setHasCameraPermission(false);
          setError(
            'Camera access was denied. Please enable camera permissions in your browser settings.'
          );
        }
      };

      getCameraPermission();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [inputMethod, imagePreview]);

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

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !hasCameraPermission) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg');

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const previewUrl = URL.createObjectURL(blob);
          setImagePreview(previewUrl);
        }
      },
      'image/jpeg',
      0.95
    );

    setImageData(dataUrl);
    setError(null);
    setDiagnosis(null);
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
    setHasCameraPermission(null);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setInputMethod('upload');
  };

  const renderInitialState = () => (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot /> AI Receipt Scanner
        </CardTitle>
        <CardDescription>
          Use your camera or upload a photo to get started.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs
          defaultValue="upload"
          value={inputMethod}
          onValueChange={(value) =>
            setInputMethod(value as 'upload' | 'camera')
          }
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">
              <Upload className="mr-2" /> Upload
            </TabsTrigger>
            <TabsTrigger value="camera">
              <Camera className="mr-2" /> Camera
            </TabsTrigger>
          </TabsList>
          <TabsContent value="upload" className="pt-4">
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
          </TabsContent>
          <TabsContent value="camera" className="pt-4 space-y-4">
            <div className="relative w-full overflow-hidden rounded-lg aspect-video bg-muted border">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                muted
                playsInline
              />
              {hasCameraPermission === false && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white p-4">
                  <XCircle className="w-10 h-10 mb-2" />
                  <p className="text-center font-semibold">
                    Camera Access Denied
                  </p>
                </div>
              )}
            </div>
            <Button
              onClick={handleCapture}
              disabled={!hasCameraPermission}
              className="w-full"
            >
              <Camera className="mr-2" /> Capture Photo
            </Button>
          </TabsContent>
        </Tabs>

        <canvas ref={canvasRef} className="hidden" />

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
              fill
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
                fill
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
                <p className="text-lg font-semibold">
                  {diagnosis.merchantName}
                </p>
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
              fill
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
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/10 via-background to-background -z-10"></div>
      <div className="z-10 flex items-center justify-center w-full h-full">
        {isLoading
          ? renderLoadingState()
          : diagnosis
            ? renderResultsState()
            : error && !diagnosis
              ? imagePreview
                ? renderErrorState()
                : renderInitialState()
              : imagePreview
                ? renderPreviewState()
                : renderInitialState()}
      </div>
    </main>
  );
}
