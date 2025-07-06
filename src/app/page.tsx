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
  Pencil,
  PlusCircle,
  Trash2,
  CalendarIcon,
  Loader2,
} from 'lucide-react';
import {useRouter} from 'next/navigation';
import {v4 as uuidv4} from 'uuid';
import {useReceipts} from '@/contexts/ReceiptContext';
import {useToast} from '@/hooks/use-toast';
import {
  scanAndNotify,
  submitManualReceipt,
  type ActionResponse,
} from '@/app/actions';
import {type DiagnoseReceiptOutput} from '@/ai/flows/diagnose-receipt-flow';
import {useForm, useFieldArray} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import {format} from 'date-fns';

import {cn} from '@/lib/utils';
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {Calendar} from '@/components/ui/calendar';

const categories = [
  'Groceries',
  'Dining',
  'Travel',
  'Shopping',
  'Utilities',
  'Entertainment',
  'Other',
];

const ManualFormSchema = z.object({
  merchantName: z.string().min(1, 'Merchant name is required.'),
  transactionDate: z.date({required_error: 'A date is required.'}),
  total: z.coerce
    .number({invalid_type_error: 'Total must be a number.'})
    .min(0, 'Total must be a positive number.'),
  category: z.string({required_error: 'Please select a category.'}),
  items: z
    .array(
      z.object({
        name: z.string().min(1, 'Item name is required.'),
        price: z.coerce
          .number({invalid_type_error: 'Price must be a number.'})
          .min(0, 'Price must be a positive number.'),
      })
    )
    .min(1, 'At least one item is required.'),
});

type ManualFormData = z.infer<typeof ManualFormSchema>;

export default function Home() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const [diagnosis, setDiagnosis] = useState<DiagnoseReceiptOutput | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const {toast} = useToast();

  const [inputMethod, setInputMethod] = useState<'upload' | 'camera' | 'manual'>(
    'upload'
  );
  const [hasCameraPermission, setHasCameraPermission] = useState<
    boolean | null
  >(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const form = useForm<ManualFormData>({
    resolver: zodResolver(ManualFormSchema),
    defaultValues: {
      merchantName: '',
      items: [
        {name: '', price: 0},
        {name: '', price: 0},
        {name: '', price: 0},
      ],
    },
  });

  const {fields, append, remove} = useFieldArray({
    control: form.control,
    name: 'items',
  });

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

  const resizeImage = (
    dataUrl: string,
    maxWidth = 1280,
    maxHeight = 1280
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        let {width, height} = img;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Could not get canvas context'));
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = (err) => reject(err);
      img.src = dataUrl;
    });
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        // 10MB limit
        setError('File is too large. Please upload an image under 10MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;
        setIsProcessingImage(true);
        try {
          const resizedDataUrl = await resizeImage(dataUrl);
          setImagePreview(URL.createObjectURL(file));
          setImageData(resizedDataUrl);
          setError(null);
          setDiagnosis(null);
        } catch (err) {
          console.error('Failed to resize image', err);
          setError(
            'Could not process the selected image. It might be in an unsupported format.'
          );
        } finally {
          setIsProcessingImage(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCapture = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !hasCameraPermission) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    setIsProcessingImage(true);

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg');

    try {
      const resizedDataUrl = await resizeImage(dataUrl);
      const blob = await (await fetch(resizedDataUrl)).blob();
      const previewUrl = URL.createObjectURL(blob);

      setImagePreview(previewUrl);
      setImageData(resizedDataUrl);
      setError(null);
      setDiagnosis(null);
    } catch (err) {
      console.error('Failed to resize and process image', err);
      setError('Could not process the captured image. Please try again.');
    } finally {
      setIsProcessingImage(false);
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
      const response = await scanAndNotify({
        photoDataUri: imageData,
      });
      setDiagnosis(response.diagnosis);
      if (response.notificationStatus.success) {
        toast({
          title: 'Scan Complete & Notified',
          description:
            'The receipt details have been sent to your Telegram channel.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Scan Complete, Notification Failed',
          description:
            response.notificationStatus.message ||
            'Could not send to Telegram channel.',
        });
      }
    } catch (e) {
      console.error(e);
      setError(
        'The AI could not process the receipt. It might be blurry or unsupported. Please try another image.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSubmit = async (data: ManualFormData) => {
    setIsLoading(true);
    setDiagnosis(null);
    setError(null);

    const payload: DiagnoseReceiptOutput = {
      ...data,
      transactionDate: format(data.transactionDate, 'yyyy-MM-dd'),
    };

    try {
      const response = await submitManualReceipt(payload);
      setDiagnosis(response.diagnosis);
      if (response.notificationStatus.success) {
        toast({
          title: 'Receipt Submitted & Notified',
          description:
            'The receipt details have been sent to your Telegram channel.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Submit Succeeded, Notification Failed',
          description:
            response.notificationStatus.message ||
            'Could not send to Telegram channel.',
        });
      }
      form.reset();
    } catch (e) {
      console.error(e);
      setError('Could not submit the receipt. Please try again.');
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
    form.reset({
      merchantName: '',
      items: [
        {name: '', price: 0},
        {name: '', price: 0},
        {name: '', price: 0},
      ],
    });
  };

  const renderInitialState = () => (
    <div className="w-full max-w-2xl text-center animate-enter">
      <div className="flex items-center justify-center gap-3 mb-2">
        <Bot className="w-9 h-9 text-primary" />
        <h1 className="text-4xl font-bold tracking-tight">RiSoCa Bot</h1>
      </div>
      <p className="mb-8 text-lg text-muted-foreground">
        Scan, capture, or manually enter a receipt.
      </p>

      <Tabs
        defaultValue="upload"
        value={inputMethod}
        onValueChange={(value) =>
          setInputMethod(value as 'upload' | 'camera' | 'manual')
        }
        className="w-full"
      >
        <TabsList className="grid w-full h-12 grid-cols-3 p-1 border rounded-lg bg-muted/50">
          <TabsTrigger value="upload" className="h-full text-base rounded-md">
            <Upload className="mr-2" /> Upload
          </TabsTrigger>
          <TabsTrigger value="camera" className="h-full text-base rounded-md">
            <Camera className="mr-2" /> Camera
          </TabsTrigger>
          <TabsTrigger value="manual" className="h-full text-base rounded-md">
            <Pencil className="mr-2" /> Manual
          </TabsTrigger>
        </TabsList>
        <TabsContent
          value="upload"
          className="pt-6 data-[state=active]:animate-in data-[state=active]:fade-in-50 data-[state=active]:duration-500"
        >
          {isProcessingImage ? (
            <div className="relative flex flex-col items-center justify-center w-full h-[202px] p-10 transition-colors border-2 border-dashed rounded-xl bg-primary/5 border-primary/20">
              <Loader2 className="w-12 h-12 animate-spin text-primary/80" />
              <p className="mt-4 text-lg font-medium text-foreground">
                Optimizing image...
              </p>
            </div>
          ) : (
            <div
              className="relative flex flex-col items-center justify-center w-full p-10 transition-colors border-2 border-dashed rounded-xl cursor-pointer bg-primary/5 hover:bg-primary/10 border-primary/20 hover:border-primary/40"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="text-center">
                <Upload className="w-12 h-12 mx-auto text-primary/80" />
                <p className="mt-4 text-lg font-medium text-foreground">
                  Click to upload or drag and drop
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  PNG, JPG, or WEBP (max 10MB)
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
          )}
        </TabsContent>
        <TabsContent
          value="camera"
          className="pt-6 space-y-4 data-[state=active]:animate-in data-[state=active]:fade-in-50 data-[state=active]:duration-500"
        >
          <div className="relative w-full overflow-hidden border rounded-xl bg-muted aspect-video">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              muted
              playsInline
            />
            {hasCameraPermission === false && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-white bg-black/70 rounded-xl">
                <XCircle className="w-12 h-12 mb-4" />
                <p className="text-lg font-semibold text-center">
                  Camera Access Denied
                </p>
              </div>
            )}
          </div>
          <Button
            onClick={handleCapture}
            disabled={!hasCameraPermission || isProcessingImage}
            className="w-full h-12 text-lg"
            size="lg"
          >
            {isProcessingImage ? (
              <Loader2 className="mr-2 animate-spin" />
            ) : (
              <Camera className="mr-2" />
            )}
            {isProcessingImage ? 'Processing...' : 'Capture Photo'}
          </Button>
        </TabsContent>
        <TabsContent
          value="manual"
          className="pt-6 data-[state=active]:animate-in data-[state=active]:fade-in-50 data-[state=active]:duration-500"
        >
          <Card>
            <CardHeader>
              <CardTitle>Manual Receipt Entry</CardTitle>
              <CardDescription>
                Fill in the details of your receipt below.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleManualSubmit)}
                  className="space-y-8"
                >
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="merchantName"
                      render={({field}) => (
                        <FormItem>
                          <FormLabel>Merchant Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Jollibee" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="transactionDate"
                      render={({field}) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Transaction Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={'outline'}
                                  className={cn(
                                    'pl-3 text-left font-normal',
                                    !field.value && 'text-muted-foreground'
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, 'PPP')
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="w-4 h-4 ml-auto opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0"
                              align="start"
                            >
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                  date > new Date() ||
                                  date < new Date('1900-01-01')
                                }
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="category"
                      render={({field}) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categories.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {cat}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="total"
                      render={({field}) => (
                        <FormItem>
                          <FormLabel>Total Amount (₱)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="e.g. 150.75"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div>
                    <FormLabel>Items</FormLabel>
                    <FormDescription className="mb-4">
                      Add the items from your receipt.
                    </FormDescription>
                    <div className="space-y-4">
                      {fields.map((field, index) => (
                        <div
                          key={field.id}
                          className="flex items-start gap-4"
                        >
                          <FormField
                            control={form.control}
                            name={`items.${index}.name`}
                            render={({field}) => (
                              <FormItem className="flex-1">
                                <FormControl>
                                  <Input placeholder="Item name" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`items.${index}.price`}
                            render={({field}) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="Price"
                                    className="w-32"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(index)}
                            disabled={fields.length <= 1}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => append({name: '', price: 0})}
                      >
                        <PlusCircle className="mr-2" /> Add Item
                      </Button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" size="lg">
                    Submit Receipt
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <canvas ref={canvasRef} className="hidden" />

      {error && !imagePreview && (
        <Alert variant="destructive" className="mt-6 text-left">
          <ServerCrash className="w-4 h-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );

  const renderPreviewState = () => (
    <div className="animate-enter">
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
                className="object-contain"
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
    </div>
  );

  const renderLoadingState = () => (
    <div className="animate-enter">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Processing Receipt</CardTitle>
          <CardDescription>
            The AI is analyzing. Please wait a moment...
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
    </div>
  );

  const renderResultsState = () =>
    diagnosis && (
      <div className="animate-enter">
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <CardTitle>Process Complete</CardTitle>
            <CardDescription>
              Here's what we got from your receipt.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-8 md:grid-cols-2">
            <div className="relative w-full overflow-hidden rounded-lg aspect-[16/10] border">
              {imagePreview ? (
                <Image
                  src={imagePreview}
                  alt="Receipt"
                  fill
                  className="object-contain"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full bg-muted">
                  <Pencil className="w-16 h-16 text-muted-foreground" />
                </div>
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
                  <p className="text-sm font-medium text-muted-foreground">
                    Date
                  </p>
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
                    ₱{diagnosis.total.toFixed(2)}
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
                          ₱{item.price.toFixed(2)}
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
              <ReceiptText className="mr-2" /> Process Another
            </Button>
          </div>
        </Card>
      </div>
    );

  const renderErrorState = () => (
    <div className="animate-enter">
      <Card className="w-full max-w-lg shadow-2xl shadow-destructive/20">
        <CardHeader>
          <CardTitle>Processing Failed</CardTitle>
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
                className="object-contain"
              />
            )}
          </div>
          <Button
            onClick={handleReset}
            variant="destructive"
            className="w-full"
          >
            <Upload className="mr-2" /> Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col items-center justify-center w-full p-4">
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
    </div>
  );
}
