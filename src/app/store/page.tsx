
'use client';

import {useState, useEffect} from 'react';
import Link from 'next/link';
import {useForm, useWatch} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  Timestamp,
  limit,
} from 'firebase/firestore';
import {db} from '@/lib/firebase';
import {submitSalesReport, type SaleItem, voidSale} from '@/app/actions';
import type {InventoryItem} from '@/lib/schemas';
import {format} from 'date-fns';

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {useToast} from '@/hooks/use-toast';
import {
  PlusCircle,
  Trash2,
  Loader2,
  Check,
  ChevronsUpDown,
  History,
  FileWarning,
} from 'lucide-react';
import {Popover, PopoverTrigger, PopoverContent} from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {cn} from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {Separator} from '@/components/ui/separator';

const SaleItemFormSchema = z.object({
  itemId: z.string().optional(),
  itemName: z.string().min(1, 'Item name is required.'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1.'),
  unitPrice: z.coerce.number().min(0, 'Unit price cannot be negative.'),
});

type SaleItemFormData = z.infer<typeof SaleItemFormSchema>;

export type SaleDoc = SaleItem & {
  id: string;
  createdAt: Timestamp;
};

export default function StorePage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [receiptItems, setReceiptItems] = useState<SaleItem[]>([]);
  const [recentSales, setRecentSales] = useState<SaleDoc[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidingSale, setVoidingSale] = useState<SaleDoc | null>(null);
  const {toast} = useToast();
  const [popoverOpen, setPopoverOpen] = useState(false);

  const form = useForm<SaleItemFormData>({
    resolver: zodResolver(SaleItemFormSchema),
    defaultValues: {
      itemName: '',
      quantity: 1,
      unitPrice: 0,
    },
  });

  const {control} = form;
  const quantity = useWatch({control, name: 'quantity'});
  const unitPrice = useWatch({control, name: 'unitPrice'});
  const subtotal = (quantity || 0) * (unitPrice || 0);

  useEffect(() => {
    const inventoryQuery = query(
      collection(db, 'inventory'),
      orderBy('name', 'asc')
    );

    const salesQuery = query(
      collection(db, 'sales'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubInventory = onSnapshot(inventoryQuery, (snapshot) => {
      setInventory(
        snapshot.docs.map(
          (doc) => ({id: doc.id, ...doc.data()}) as InventoryItem
        )
      );
    });

    const unsubSales = onSnapshot(salesQuery, (snapshot) => {
      setRecentSales(
        snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}) as SaleDoc)
      );
    });

    return () => {
      unsubInventory();
      unsubSales();
    };
  }, []);

  const handleAddItem = (data: SaleItemFormData) => {
    const total = data.quantity * data.unitPrice;
    setReceiptItems((prev) => [...prev, {...data, total}]);
    form.reset({
      itemName: '',
      quantity: 1,
      unitPrice: 0,
      itemId: undefined,
    });
    const input = document.querySelector(
      'input[name="itemName"]'
    ) as HTMLInputElement | null;
    input?.focus();
  };

  const handleFinalSubmit = async () => {
    if (receiptItems.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Empty Sale',
        description: 'Please add at least one item to the receipt.',
      });
      return;
    }
    setIsSubmitting(true);
    const response = await submitSalesReport({items: receiptItems});

    if (response.success) {
      toast({
        title: 'Success',
        description: 'Sales report submitted and inventory updated.',
      });
      setReceiptItems([]);
    } else {
      toast({
        variant: 'destructive',
        title: 'Submission Failed',
        description: response.message || 'An unknown error occurred.',
      });
    }
    setIsSubmitting(false);
  };

  const handleVoidSale = async () => {
    if (!voidingSale) return;
    setIsVoiding(true);

    // Manually create a plain object to pass to the server action,
    // ensuring no complex objects like Timestamps are included.
    const plainSaleObject = {
      id: voidingSale.id,
      itemId: voidingSale.itemId,
      itemName: voidingSale.itemName,
      quantity: voidingSale.quantity,
      unitPrice: voidingSale.unitPrice,
      total: voidingSale.total,
    };

    const response = await voidSale(plainSaleObject);

    if (response.success) {
      toast({title: 'Sale Voided', description: 'The sale has been removed.'});
    } else {
      toast({
        variant: 'destructive',
        title: 'Voiding Failed',
        description: response.message || 'An unknown error occurred.',
      });
    }
    setVoidingSale(null);
    setIsVoiding(false);
  };

  const grandTotal = receiptItems.reduce((acc, item) => acc + item.total, 0);

  return (
    <>
      <div className="p-4 md:p-6 space-y-6">
        <Card className="shadow-sm">
          <CardHeader className="text-center">
            <CardTitle>Record Sale</CardTitle>
            <CardDescription>
              Add items to build the transaction receipt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleAddItem)}
                className="space-y-4 p-4 border rounded-lg bg-background"
              >
                <FormField
                  control={form.control}
                  name="itemName"
                  render={({field}) => (
                    <FormItem>
                      <FormLabel>Item</FormLabel>
                      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                'w-full justify-between',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value || 'Select or type an item'}
                              <ChevronsUpDown className="w-4 h-4 ml-2 opacity-50 shrink-0" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <Command
                            filter={(value, search) =>
                              value.toLowerCase().includes(search.toLowerCase())
                                ? 1
                                : 0
                            }
                          >
                            <CommandInput
                              placeholder="Search inventory..."
                              onValueChange={(search) => {
                                form.setValue('itemName', search);
                                form.setValue('itemId', undefined);
                              }}
                            />
                            <CommandList>
                              <CommandEmpty>
                                No inventory item found.
                              </CommandEmpty>
                              <CommandGroup>
                                {inventory.map((item) => (
                                  <CommandItem
                                    value={item.name}
                                    key={item.id}
                                    onSelect={() => {
                                      form.setValue('itemName', item.name);
                                      form.setValue('unitPrice', item.price);
                                      form.setValue('itemId', item.id);
                                      setPopoverOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        'mr-2 h-4 w-4',
                                        field.value === item.name
                                          ? 'opacity-100'
                                          : 'opacity-0'
                                      )}
                                    />
                                    <span>{item.name}</span>
                                    <span className="ml-auto text-xs text-muted-foreground">
                                      Stock: {item.stock}
                                    </span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({field}) => (
                      <FormItem>
                        <FormLabel>Qty</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="unitPrice"
                    render={({field}) => (
                      <FormItem>
                        <FormLabel>Price</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {subtotal > 0 && (
                  <div className="text-right text-lg font-medium pr-1 pt-2">
                    <span className="text-muted-foreground">Subtotal: </span>
                    <span className="font-mono font-bold text-foreground">
                      ₱{subtotal.toFixed(2)}
                    </span>
                  </div>
                )}

                <Button type="submit" className="w-full">
                  <PlusCircle className="mr-2" />
                  Add to Sale
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {receiptItems.length > 0 && (
          <Card className="shadow-sm animate-enter">
            <CardHeader className="text-center">
              <CardTitle className="text-xl font-bold">Current Sale</CardTitle>
              <CardDescription className="text-xs">
                Date: {format(new Date(), 'MM/dd/yyyy')} | Time:{' '}
                {format(new Date(), 'p')}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receiptItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {item.itemName}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ₱{item.unitPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ₱{item.total.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Separator className="my-4" />
              <div className="flex justify-between items-baseline px-2">
                <p className="text-lg font-bold">Total:</p>
                <p className="text-2xl font-bold font-mono">
                  ₱{grandTotal.toFixed(2)}
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex-col items-center justify-center p-4 text-center text-xs text-muted-foreground">
              <p>Thank you for your business!</p>
            </CardFooter>
          </Card>
        )}

        <Button
          size="lg"
          className="w-full"
          onClick={handleFinalSubmit}
          disabled={isSubmitting || receiptItems.length === 0}
        >
          {isSubmitting && <Loader2 className="mr-2 animate-spin" />}
          Submit Sale
        </Button>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Sales History</CardTitle>
            <CardDescription>
              Here are the 5 most recent sales. You can void them if needed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {recentSales.length > 0 ? (
                recentSales.map((sale) => (
                  <li
                    key={sale.id}
                    className="flex items-center justify-between p-2 rounded-md bg-background"
                  >
                    <div>
                      <p className="font-medium">{sale.itemName}</p>
                      <p className="text-xs text-muted-foreground">
                        {sale.quantity} x ₱{sale.unitPrice.toFixed(2)} = ₱
                        {sale.total.toFixed(2)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setVoidingSale(sale)}
                    >
                      <Trash2 className="mr-2 w-4 h-4 text-destructive" />
                      Void
                    </Button>
                  </li>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-6 border-2 border-dashed rounded-lg">
                  <FileWarning className="w-10 h-10 mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    No sales recorded yet.
                  </p>
                </div>
              )}
            </ul>
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" className="w-full">
              <Link href="/store/history">
                <History className="mr-2" />
                View Full History
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      <AlertDialog
        open={!!voidingSale}
        onOpenChange={(open) => !open && setVoidingSale(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently void the sale for "{voidingSale?.itemName}
              ". The stock for this item will be restored. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleVoidSale}
              disabled={isVoiding}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isVoiding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, Void Sale
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
