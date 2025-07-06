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
import {submitSalesReport, type SaleItem} from '@/app/actions';
import type {InventoryItem} from '@/lib/schemas';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
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
  Store,
  History,
  CalendarDays,
  ArrowRight,
  PackageSearch,
  Check,
  ChevronsUpDown,
} from 'lucide-react';
import {ScrollArea} from '@/components/ui/scroll-area';
import {Tabs, TabsList, TabsTrigger} from '@/components/ui/tabs';
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
    <div className="mt-6 text-right">
      <p className="text-lg font-semibold">
        Grand Total:{' '}
        <span className="font-mono">₱{grandTotal.toFixed(2)}</span>
      </p>
    </div>
  );
};

export default function StorePage() {
  const [allSales, setAllSales] = useState<SaleDoc[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [historyLimit, setHistoryLimit] = useState(5);
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

  useEffect(() => {
    setIsLoading(true);
    const salesQuery = query(
      collection(db, 'sales'),
      orderBy('createdAt', 'desc')
    );
    const inventoryQuery = query(
      collection(db, 'inventory'),
      orderBy('name', 'asc')
    );

    const unsubscribeSales = onSnapshot(
      salesQuery,
      (querySnapshot) => {
        const salesFromDb: SaleDoc[] = [];
        querySnapshot.forEach((doc) => {
          salesFromDb.push({
            id: doc.id,
            ...doc.data(),
          } as SaleDoc);
        });
        setAllSales(salesFromDb);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching sales from Firestore:', error);
        toast({
          variant: 'destructive',
          title: 'Database Error',
          description: 'Could not fetch sales data.',
        });
        setIsLoading(false);
      }
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
      unsubscribeSales();
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaysSales = allSales.filter(
    (sale) => sale.createdAt.toDate() >= today
  );
  const todaysTotal = todaysSales.reduce((acc, sale) => acc + sale.total, 0);
  const recentHistory = allSales.slice(0, historyLimit);

  return (
    <div className="flex flex-1 flex-col p-4 md:p-6 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Store className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">RiSoCa Store</h1>
            <p className="text-muted-foreground">
              Log your daily sales and track your history.
            </p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href="/store/inventory">
            <PackageSearch className="mr-2" />
            Manage Inventory
          </Link>
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-lg">
          <CardHeader>
            <CardTitle>Submit Daily Sales</CardTitle>
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
                          <FormItem className="flex-1">
                            <FormLabel>Item Name</FormLabel>
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
                                      // Allow custom values
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
                      <div className="flex gap-4 w-full sm:w-auto">
                        <FormField
                          control={form.control}
                          name={`items.${index}.quantity`}
                          render={({field}) => (
                            <FormItem className="flex-1 sm:w-24">
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
                            <FormItem className="flex-1 sm:w-32">
                              <FormLabel>Unit Price (₱)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="150.00"
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
                        className="mt-0 sm:mt-7 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="sr-only">Remove Item</span>
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      append({itemName: '', quantity: 1, unitPrice: 0})
                    }
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

        <div className="space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5" /> Today's Sales
              </CardTitle>
              <CardDescription>
                Total for today:{' '}
                <span className="font-bold text-primary font-mono">
                  ₱{todaysTotal.toFixed(2)}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-72">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todaysSales.length > 0 ? (
                      todaysSales.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell>
                            <p className="font-medium">{sale.itemName}</p>
                            <p className="text-xs text-muted-foreground">
                              {sale.quantity} x ₱{sale.unitPrice.toFixed(2)}
                            </p>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ₱{sale.total.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          className="text-center text-muted-foreground py-10"
                        >
                          No sales logged today.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1.5">
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-5 h-5" /> Sales History
                  </CardTitle>
                  <CardDescription>
                    Showing the last {historyLimit} transactions.
                  </CardDescription>
                </div>
                <Tabs
                  defaultValue="5"
                  onValueChange={(value) => setHistoryLimit(Number(value))}
                  className="w-auto"
                >
                  <TabsList className="h-8">
                    <TabsTrigger value="5" className="h-6 text-xs px-2">
                      5
                    </TabsTrigger>
                    <TabsTrigger value="10" className="h-6 text-xs px-2">
                      10
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentHistory.length > 0 ? (
                      recentHistory.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell>
                            <p className="font-medium">{sale.itemName}</p>
                            <p className="text-xs text-muted-foreground">
                              {sale.createdAt.toDate().toLocaleDateString()}
                            </p>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ₱{sale.total.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          className="text-center text-muted-foreground py-10"
                        >
                          No sales history yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full">
                <Link href="/store/history">
                  View Full History <ArrowRight className="ml-2" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
