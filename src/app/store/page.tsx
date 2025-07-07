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
} from 'firebase/firestore';
import {db} from '@/lib/firebase';
import {submitSalesReport, type SaleItem, voidSale} from '@/app/actions';
import type {InventoryItem} from '@/lib/schemas';

import {
  Card,
  CardContent,
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
    <div className="mt-4 sm:mt-0 text-right">
      <p className="text-lg font-semibold">
        Grand Total:{' '}
        <span className="font-mono">
          ₱
          {grandTotal.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      </p>
    </div>
  );
};

export default function StorePage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {toast} = useToast();
  const [openPopovers, setOpenPopovers] = useState<Record<number, boolean>>({});
  const [openQtyPopovers, setOpenQtyPopovers] = useState<
    Record<number, boolean>
  >({});

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

  useEffect(() => {
    const inventoryQuery = query(
      collection(db, 'inventory'),
      orderBy('name', 'asc')
    );

    const unsubscribeInventory = onSnapshot(
      inventoryQuery,
      (querySnapshot) => {
        const inventoryFromDb: InventoryItem[] = [];
        querySnapshot.forEach((doc) => {
          inventoryFromDb.push({
            id: doc.id,
            ...doc.data(),
          } as InventoryItem);
        });
        setInventory(inventoryFromDb);
      },
      (error) => {
        console.error('Error fetching inventory from Firestore:', error);
        toast({
          variant: 'destructive',
          title: 'Database Error',
          description: 'Could not fetch inventory data.',
        });
      }
    );

    return () => {
      unsubscribeInventory();
    };
  }, [toast]);

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

  const setPopoverOpen = (index: number, open: boolean) => {
    setOpenPopovers((prev) => ({...prev, [index]: open}));
  };

  const setQtyPopoverOpen = (index: number, open: boolean) => {
    setOpenQtyPopovers((prev) => ({...prev, [index]: open}));
  };

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-3xl font-bold">Point of Sale</h1>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Submit Sales</CardTitle>
          <CardDescription>
            Add items sold today. Stock will be updated automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleFormSubmit)}
              className="space-y-6"
            >
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="flex flex-col sm:flex-row items-start gap-4 p-4 border rounded-lg bg-muted/50"
                  >
                    <FormField
                      control={form.control}
                      name={`items.${index}.itemName`}
                      render={({field}) => (
                        <FormItem className="flex-1 w-full">
                          <FormLabel className="sr-only sm:not-sr-only">Item Name</FormLabel>
                          <Popover
                            open={openPopovers[index]}
                            onOpenChange={(open) => setPopoverOpen(index, open)}
                          >
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn(
                                    'w-full justify-between bg-background',
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
                                filter={(value, search) => {
                                  if (
                                    value
                                      .toLowerCase()
                                      .includes(search.toLowerCase())
                                  )
                                    return 1;
                                  return 0;
                                }}
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
                                        <div className="flex justify-between w-full items-center">
                                          <span>{item.name}</span>
                                          <div className="flex flex-col items-end">
                                            <span className="text-muted-foreground text-xs leading-none">
                                              Stock
                                            </span>
                                            <span className="font-medium leading-tight">
                                              {item.stock}
                                            </span>
                                          </div>
                                        </div>
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
                    <div className="flex gap-2 w-full sm:w-auto">
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({field}) => (
                          <FormItem className="flex-1">
                            <FormLabel className="sr-only sm:not-sr-only">Qty</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="Qty"
                                className="text-center bg-background"
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
                          <FormItem className="flex-1">
                            <FormLabel className="sr-only sm:not-sr-only">Price (₱)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Price"
                                className="bg-background"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      disabled={fields.length <= 1}
                      className="mt-0 sm:mt-6 text-destructive hover:bg-destructive/10 self-center sm:self-auto"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="sr-only">Remove Item</span>
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({itemName: '', quantity: 1, unitPrice: 0})
                  }
                  className="w-full sm:w-auto"
                >
                  <PlusCircle className="mr-2" /> Add Another Item
                </Button>
                <SalesFormTotals control={form.control} />
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 animate-spin" />
                ) : null}
                Submit Sales Report
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
