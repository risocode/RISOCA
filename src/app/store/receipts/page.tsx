
'use client';

import {useState, useRef, type ChangeEvent, useEffect} from 'react';
import Image from 'next/image';
import {
  Upload,
  ReceiptText,
  X,
  ServerCrash,
  Camera,
  Pencil,
  PlusCircle,
  Trash2,
  CalendarIcon,
  Loader2,
  Wallet,
  FileText,
  Tag,
  Save,
} from 'lucide-react';
import {useReceipts} from '@/contexts/ReceiptContext';
import {useToast} from '@/hooks/use-toast';
import {diagnoseReceipt} from '@/ai/flows/diagnose-receipt-flow';
import {submitManualReceipt} from '@/app/actions';
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
  CardFooter,
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
import {ScrollArea} from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const categories = [
  'Groceries',
  'Dining',
  'Travel',
  'Shopping',
  'Utilities',
  'Entertainment',
  'Other',
];

const ReceiptFormSchema = z.object({
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

type ReceiptFormData = z.infer<typeof ReceiptFormSchema>;

export default function ReceiptPage() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const [diagnosis, setDiagnosis] = useState<DiagnoseReceiptOutput | null>(
    null
  );
  const [editableDiagnosis, setEditableDiagnosis] =
    useState<DiagnoseReceiptOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const {toast} = useToast();

  const form = useForm<ReceiptFormData>({
    resolver: zodResolver(ReceiptFormSchema),
    defaultValues: {
      merchantName: '',
      items: [{name: '', price: 0}],
    },
  });

  const {fields, append, remove} = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const items = form.watch('items');
  useEffect(() => {
    const total = items.reduce(
      (sum, item) => sum + (Number(item.price) || 0),
      0
    );
    const roundedTotal = Math.round(total * 100) / 100;
    form.setValue('total', roundedTotal, {shouldValidate: true});
  }, [items, form]);

  const {
    receipts,
    totalSpent,
    categories: receiptCategories,
  } = useReceipts();
  const uniqueCategories = Object.keys(receiptCategories).length;

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

  const handleScanReceipt = async () => {
    if (!imageData || !imagePreview) {
      setError('Please select an image first.');
      return;
    }
    setIsLoading(true);
    setEditableDiagnosis(null);
    setError(null);

    try {
      const diagnosisResult = await diagnoseReceipt({photoDataUri: imageData});
      setEditableDiagnosis(diagnosisResult);
      form.reset({
        ...diagnosisResult,
        transactionDate: new Date(
          diagnosisResult.transactionDate + 'T00:00:00'
        ),
      });
    } catch (e) {
      console.error(e);
      setError('The AI could not process the receipt. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalSubmit = async (data: ReceiptFormData) => {
    setIsLoading(true);
    setError(null);

    const payload: DiagnoseReceiptOutput = {
      ...data,
      transactionDate: format(data.transactionDate, 'yyyy-MM-dd'),
    };

    try {
      const response = await submitManualReceipt(payload, imageData);
      setDiagnosis(response.diagnosis);
      setEditableDiagnosis(null);
      toast({
        variant: 'success',
        title: 'Receipt Saved!',
      });
      form.reset();
    } catch (e) {
      console.error(e);
      setError('Could not save the receipt. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setImagePreview(null);
    setImageData(null);
    setDiagnosis(null);
    setEditableDiagnosis(null);
    setError(null);
    setIsLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
    form.reset({merchantName: '', items: [{name: '', price: 0}]});
  };

  const renderInitialState = () => (
    <div className="w-full text-center animate-enter">
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full h-12 grid-cols-3 p-1">
          <TabsTrigger value="upload" className="h-full text-base">
            <Upload className="mr-2" /> Upload
          </TabsTrigger>
          <TabsTrigger value="camera" className="h-full text-base">
            <Camera className="mr-2" /> Camera
          </TabsTrigger>
          <TabsTrigger value="manual" className="h-full text-base">
            <Pencil className="mr-2" /> Manual
          </TabsTrigger>
        </TabsList>
        <TabsContent value="upload" className="pt-6">
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
              <Upload className="w-12 h-12 mx-auto text-primary/80" />
              <p className="mt-4 text-lg font-medium text-foreground">
                Click to upload
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                PNG, JPG, WEBP (max 10MB)
              </p>
            </div>
          )}
        </TabsContent>
        <TabsContent value="camera" className="pt-6">
          <div
            className="relative flex flex-col items-center justify-center w-full p-10 transition-colors border-2 border-dashed rounded-xl cursor-pointer bg-primary/5 hover:bg-primary/10 border-primary/20 hover:border-primary/40"
            onClick={() => cameraInputRef.current?.click()}
          >
            <Camera className="w-12 h-12 mx-auto text-primary/80" />
            <p className="mt-4 text-lg font-medium text-foreground">
              Open Camera
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Capture a photo of your receipt
            </p>
          </div>
        </TabsContent>
        <TabsContent value="manual" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle>Manual Entry</CardTitle>
              <CardDescription>
                Fill in the details of your receipt.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleFinalSubmit)}
                  className="space-y-8"
                >
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <FormField
                      name="merchantName"
                      control={form.control}
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
                      name="transactionDate"
                      control={form.control}
                      render={({field}) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Transaction Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
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
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      name="category"
                      control={form.control}
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
                      name="total"
                      control={form.control}
                      render={({field}) => (
                        <FormItem>
                          <FormLabel>Total Amount (₱)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="e.g. 150.75"
                              {...field}
                              disabled
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div>
                    <FormLabel>Items</FormLabel>
                    <div className="space-y-2 mt-2">
                      {fields.map((field, index) => (
                        <div key={field.id} className="flex items-start gap-2">
                          <FormField
                            name={`items.${index}.name`}
                            control={form.control}
                            render={({field}) => (
                              <FormItem className="flex-grow">
                                <FormControl>
                                  <Input placeholder="Item name" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            name={`items.${index}.price`}
                            control={form.control}
                            render={({field}) => (
                              <FormItem className="w-32">
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="Price"
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
                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 animate-spin" />
                    ) : null}
                    Submit Receipt
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Input
        ref={fileInputRef}
        type="file"
        className="sr-only"
        accept="image/png, image/jpeg, image/webp"
        onChange={handleFileChange}
      />
      <Input
        ref={cameraInputRef}
        type="file"
        className="sr-only"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
      />
    </div>
  );

  const renderContent = () => {
    if (isLoading) return renderLoadingState();
    if (diagnosis) return renderResultsState();
    if (editableDiagnosis) return renderEditableFormState();
    if (error)
      return imagePreview ? renderErrorState() : renderInitialState();
    if (imagePreview) return renderPreviewState();
    return renderInitialState();
  };

  const renderPreviewState = () => (
    <div className="animate-enter w-full">
      <Card>
        <CardHeader>
          <CardTitle>Ready to Scan</CardTitle>
          <CardDescription>
            Click the button below to analyze your receipt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative w-full overflow-hidden rounded-lg aspect-[16/10] border">
            <Image
              src={imagePreview!}
              alt="Receipt preview"
              fill
              className="object-contain"
            />
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

  const renderEditableFormState = () => (
    <div className="w-full animate-enter">
      <Card>
        <CardHeader>
          <CardTitle>Review & Edit</CardTitle>
          <CardDescription>
            Check the scanned data and make any corrections before saving.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="relative w-full overflow-hidden rounded-lg aspect-video border">
              {imagePreview && (
                <Image
                  src={imagePreview}
                  alt="Scanned receipt"
                  fill
                  className="object-contain"
                />
              )}
            </div>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleFinalSubmit)}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    name="merchantName"
                    control={form.control}
                    render={({field}) => (
                      <FormItem>
                        <FormLabel>Merchant</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="transactionDate"
                    control={form.control}
                    render={({field}) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
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
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date > new Date() ||
                                date < new Date('1900-01-01')
                              }
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="category"
                    control={form.control}
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
                    name="total"
                    control={form.control}
                    render={({field}) => (
                      <FormItem>
                        <FormLabel>Total (₱)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} disabled />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div>
                  <FormLabel>Items</FormLabel>
                  <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-2">
                    {fields.map((field, index) => (
                      <div key={field.id} className="flex items-start gap-2">
                        <FormField
                          name={`items.${index}.name`}
                          control={form.control}
                          render={({field}) => (
                            <FormItem className="flex-grow">
                              <FormControl>
                                <Input placeholder="Item name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          name={`items.${index}.price`}
                          control={form.control}
                          render={({field}) => (
                            <FormItem className="w-28">
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="Price"
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
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => append({name: '', price: 0})}
                  >
                    <PlusCircle className="mr-2" /> Add Item
                  </Button>
                </div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={handleReset}>
                    <X className="mr-2" /> Discard Changes
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="mr-2 animate-spin" />
                    ) : (
                      <Save className="mr-2" />
                    )}
                    Save Receipt
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderLoadingState = () => (
    <div className="animate-enter w-full">
      <Card>
        <CardHeader>
          <CardTitle>Processing Receipt</CardTitle>
          <CardDescription>
            The AI is analyzing. Please wait...
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
      <div className="animate-enter w-full">
        <Card>
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
                    ₱
                    {diagnosis.total.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
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
                <ScrollArea className="h-48 rounded-md border bg-muted/50">
                  <div className="p-3 text-sm">
                    <ul className="space-y-2">
                      {diagnosis.items.map((item, index) => (
                        <li
                          key={index}
                          className="flex justify-between py-1 border-b last:border-none"
                        >
                          <span className="pr-2 truncate">{item.name}</span>
                          <span className="flex-shrink-0">
                            ₱
                            {item.price.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </ScrollArea>
              </div>
            </div>
          </CardContent>
          <CardFooter className="p-6 pt-0">
            <Button onClick={handleReset} className="w-full">
              <ReceiptText className="mr-2" /> Process Another
            </Button>
          </CardFooter>
        </Card>
      </div>
    );

  const renderErrorState = () => (
    <div className="animate-enter w-full">
      <Card className="shadow-2xl shadow-destructive/20">
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
          <Button onClick={handleReset} variant="destructive" className="w-full">
            <Upload className="mr-2" /> Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const HistoryTabContent = () =>
    receipts.length === 0 ? (
      <div className="flex flex-col items-center justify-center text-center p-8 mt-8 border rounded-lg bg-card">
        <FileText className="w-16 h-16 mb-4 text-muted-foreground" />
        <h2 className="text-2xl font-semibold">No Receipts Scanned</h2>
        <p className="max-w-md mt-2 text-muted-foreground">
          Go to the 'Add Receipt' tab to upload one.
        </p>
      </div>
    ) : (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
              <Wallet className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₱
                {totalSpent.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                from {receipts.length} receipts
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                Receipts Scanned
              </CardTitle>
              <FileText className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{receipts.length}</div>
              <p className="text-xs text-muted-foreground">Keep them coming!</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                Unique Categories
              </CardTitle>
              <Tag className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{uniqueCategories}</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {Object.keys(receiptCategories).map((cat) => (
                  <Badge key={cat} variant="secondary">
                    {cat}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Receipt History</CardTitle>
            <CardDescription>
              A list of all your scanned receipts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map((receipt) => (
                  <TableRow key={receipt.id}>
                    <TableCell className="font-medium">
                      {receipt.merchantName}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {new Date(
                        receipt.transactionDate + 'T00:00:00'
                      ).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{receipt.category}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono whitespace-nowrap">
                      ₱
                      {receipt.total.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );

  return (
    <div className="flex flex-1 flex-col p-4 md:p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Expenses</h1>
      </header>

      <Tabs defaultValue="add" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="add">Add Expense</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="add" className="pt-4">
          <div className="flex flex-col justify-start w-full animate-page-enter">
            {renderContent()}
          </div>
        </TabsContent>
        <TabsContent value="history" className="pt-4">
          <div className="animate-page-enter">
            <HistoryTabContent />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
