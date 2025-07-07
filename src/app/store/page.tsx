
'use client';

import {useState, useEffect} from 'react';
import Link from 'next/link';
import {useForm, useFieldArray, useWatch, type Control} from 'react-hook-form';
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

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
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

const SaleItemSchema = z.object({
  itemId: z.string().optional(),
  itemName: z.string().min(1, 'Item name is required.'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1.'),
  unitPrice: z.coerce.number().min(0, 'Unit price cannot be negative.'),
});

const SalesFormSchema = z.object({
  items: z.array(SaleItemSchema).min(1, 'Please add at least one item.'),
});

type SalesFormData = z.infer<typeof SalesFormSchema>;

export type SaleDoc = SaleItem & {
  id: string;
  createdAt: Timestamp;
};

const SalesFormTotals = ({control}: {control: Control<SalesFormData>}) => {
  const items = useWatch({
    control,
    name: 'items',
  });

  const grandTotal = items.reduce((acc, item) => {
    const qty = parseFloat(item.quantity as any) || 0;
    const price = parseFloat(item.unitPrice as any) || 0;
    return acc + qty * price;
  }, 0);

  return (
    <div className="mt-6 text-center">
      <p className="text-lg font-semibold text-muted-foreground">
        Grand Total
      </p>
      <p className="font-mono text-4xl font-bold tracking-tight">
        ₱
        {grandTotal.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </p>
    </div>
  );
};

export default function StorePage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [recentSales, setRecentSales] = useState<SaleDoc[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidingSale, setVoidingSale] = useState<SaleDoc | null>(null);
  const {toast} = useToast();
  const [openPopovers, setOpenPopovers] = useState<Record<number, boolean>>({});

  const form = useForm<SalesFormData>({
    resolver: zodResolver(SalesFormSchema),
    defaultValues: {
      items: [{itemName: '', quantity: 1, unitPrice: 0}],
    },
  });

  const {fields, append, remove} = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const watchedItems = useWatch({
    control: form.control,
    name: 'items',
    defaultValue: [],
  });

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

  const handleFormSubmit = async (data: SalesFormData) => {
    setIsSubmitting(true);
    const reportItems: SaleItem[] = data.items.map((item) => ({
      ...item,
      total: item.quantity * item.unitPrice,
    }));

    const response = await submitSalesReport({items: reportItems});

    if (response.success) {
      toast({
        title: 'Success',
        description: 'Sales report submitted and inventory updated.',
      });
      form.reset({
        items: [{itemName: '', quantity: 1, unitPrice: 0}],
      });
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

    const {createdAt, ...saleToVoid} = voidingSale;
    const response = await voidSale(saleToVoid);

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

  const setPopoverOpen = (index: number, open: boolean) => {
    setOpenPopovers((prev) => ({...prev, [index]: open}));
  };

  return (
    <>
      <div className="p-4 md:p-6 space-y-6">
        <Card className="shadow-sm">
          <CardHeader className="text-center">
            <CardTitle>Record Sale</CardTitle>
            <CardDescription>
              Add items sold to update inventory and track revenue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleFormSubmit)}
                className="space-y-6"
              >
                <div className="space-y-4">
                  {fields.map((field, index) => {
                    const itemData = watchedItems[index] || {};
                    const quantity = Number(itemData.quantity) || 0;
                    const unitPrice = Number(itemData.unitPrice) || 0;
                    const subtotal = quantity * unitPrice;

                    return (
                      <div
                        key={field.id}
                        className="space-y-4 p-4 border rounded-lg bg-background relative"
                      >
                        <div className="absolute top-2 right-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(index)}
                            disabled={fields.length <= 1}
                            className="text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="sr-only">Remove</span>
                          </Button>
                        </div>
                        <FormField
                          control={form.control}
                          name={`items.${index}.itemName`}
                          render={({field}) => (
                            <FormItem>
                              <FormLabel>Item</FormLabel>
                              <Popover
                                open={openPopovers[index]}
                                onOpenChange={(open) =>
                                  setPopoverOpen(index, open)
                                }
                              >
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
                                      value
                                        .toLowerCase()
                                        .includes(search.toLowerCase())
                                        ? 1
                                        : 0
                                    }
                                  >
                                    <CommandInput
                                      placeholder="Search inventory..."
                                      onValueChange={(search) => {
                                        form.setValue(
                                          `items.${index}.itemName`,
                                          search
                                        );
                                        form.setValue(
                                          `items.${index}.itemId`,
                                          undefined
                                        );
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
                                              form.setValue(
                                                `items.${index}.itemName`,
                                                item.name
                                              );
                                              form.setValue(
                                                `items.${index}.unitPrice`,
                                                item.price
                                              );
                                              form.setValue(
                                                `items.${index}.itemId`,
                                                item.id
                                              );
                                              setPopoverOpen(index, false);
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
                            name={`items.${index}.quantity`}
                            render={({field}) => (
                              <FormItem>
                                <FormLabel>Qty</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="1"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`items.${index}.unitPrice`}
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

                        <Separator />

                        <div className="flex justify-between items-center text-right">
                          <span className="text-sm font-medium text-muted-foreground">
                            Subtotal
                          </span>
                          <span className="font-mono font-semibold text-lg">
                            ₱
                            {subtotal.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col items-center gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      append({itemName: '', quantity: 1, unitPrice: 0})
                    }
                    className="w-full sm:w-auto"
                  >
                    <PlusCircle className="mr-2" /> Add Another Item
                  </Button>
                  <SalesFormTotals control={form.control} />
                </div>

                <CardFooter className="p-0 pt-6">
                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={isSubmitting}
                  >
                    {isSubmitting && <Loader2 className="mr-2 animate-spin" />}
                    Submit Sale
                  </Button>
                </CardFooter>
              </form>
            </Form>
          </CardContent>
        </Card>

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
