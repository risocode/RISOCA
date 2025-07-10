
'use client';

import React, {useState, useEffect} from 'react';
import Link from 'next/link';
import {useForm, useWatch} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  limit,
} from 'firebase/firestore';
import {db} from '@/lib/firebase';
import {submitSaleTransaction, voidSaleTransaction} from '@/app/actions';
import type {
  InventoryItem,
  SaleItem,
  SaleTransaction,
} from '@/lib/schemas';
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
  Printer,
  Plus,
  Minus,
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
import {Badge} from '@/components/ui/badge';

const SaleItemFormSchema = z.object({
  itemId: z.string().optional(),
  itemName: z.string().min(1, 'Item name is required.'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1.'),
  unitPrice: z.coerce.number().min(0, 'Unit price cannot be negative.'),
});

type SaleItemFormData = z.infer<typeof SaleItemFormSchema>;

export default function StorePage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [receiptItems, setReceiptItems] = useState<SaleItem[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<
    SaleTransaction[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [voidingTransaction, setVoidingTransaction] =
    useState<SaleTransaction | null>(null);
  const {toast} = useToast();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [isItemDeleteAlertOpen, setIsItemDeleteAlertOpen] = useState(false);
  const [itemToDeleteIndex, setItemToDeleteIndex] = useState<number | null>(
    null
  );
  const [searchValue, setSearchValue] = useState('');

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

    const transactionQuery = query(
      collection(db, 'saleTransactions'),
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

    const unsubTransactions = onSnapshot(transactionQuery, (snapshot) => {
      setRecentTransactions(
        snapshot.docs.map(
          (doc) => ({id: doc.id, ...doc.data()}) as SaleTransaction
        )
      );
    });

    return () => {
      unsubInventory();
      unsubTransactions();
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
    setSearchValue('');
    const input = document.querySelector(
      'input[name="itemName"]'
    ) as HTMLInputElement | null;
    input?.focus();
  };

  const handleOpenDeleteAlert = (index: number) => {
    setItemToDeleteIndex(index);
    setIsItemDeleteAlertOpen(true);
  };

  const handleConfirmDeleteItem = () => {
    if (itemToDeleteIndex !== null) {
      setReceiptItems((prev) =>
        prev.filter((_, i) => i !== itemToDeleteIndex)
      );
      setItemToDeleteIndex(null);
    }
    setIsItemDeleteAlertOpen(false);
  };

  const handleFinalSubmit = async () => {
    if (receiptItems.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Cannot submit an empty sale.',
      });
      return;
    }
    setIsSubmitting(true);
    const grandTotal = receiptItems.reduce((acc, item) => acc + item.total, 0);
    const response = await submitSaleTransaction({
      items: receiptItems,
      customerName: customerName || undefined,
      total: grandTotal,
      status: 'active',
    });

    if (response.success) {
      toast({
        variant: 'success',
        title: 'Sale Submitted',
      });
      setReceiptItems([]);
      setCustomerName('');
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: response.message || 'An unknown error occurred.',
      });
    }
    setIsSubmitting(false);
  };

  const handleVoidTransaction = async () => {
    if (!voidingTransaction) return;
    setIsVoiding(true);

    const response = await voidSaleTransaction(voidingTransaction.id);

    if (response.success) {
      toast({
        variant: 'destructive',
        title: 'Transaction Voided',
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: response.message || 'An unknown error occurred.',
      });
    }
    setVoidingTransaction(null);
    setIsVoiding(false);
  };

  const grandTotal = receiptItems.reduce((acc, item) => acc + item.total, 0);

  return (
    <>
      <div className="p-4 md:p-6 space-y-6 opacity-0 animate-page-enter">
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
                <Input
                  placeholder="Customer Name (Optional)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="flex-grow"
                />

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
                              value={searchValue}
                              onValueChange={(search) => {
                                setSearchValue(search);
                                form.setValue('itemName', search);
                                form.setValue('itemId', undefined);
                                form.setValue('unitPrice', 0);
                              }}
                            />
                            <CommandList>
                              <CommandEmpty>
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                  No inventory item found.{' '}
                                  {searchValue && (
                                    <button
                                      type="button"
                                      className="text-primary hover:underline"
                                      onClick={() => {
                                        form.setValue('itemName', searchValue);
                                        setPopoverOpen(false);
                                      }}
                                    >
                                      (Record Item)
                                    </button>
                                  )}
                                </div>
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
                                      setSearchValue(item.name);
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
                          <div className="relative">
                            <Input
                              {...field}
                              type="number"
                              placeholder="1"
                              className="pr-20 text-center no-spinners"
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value, 10) || 1)
                              }
                              min="1"
                            />
                            <div className="absolute inset-y-0 right-0.5 flex items-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                  field.onChange(Math.max(1, (field.value || 1) - 1))
                                }
                                disabled={field.value <= 1}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                  field.onChange((field.value || 0) + 1)
                                }
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
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
                            className="no-spinners"
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
                  Add Item
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
                    <TableHead className="text-right">Action</TableHead>
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
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDeleteAlert(index)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                          <span className="sr-only">Remove item</span>
                        </Button>
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
              Here are the 5 most recent sales. You can void or print them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {recentTransactions.length > 0 ? (
                recentTransactions.map((tx) => (
                  <li
                    key={tx.id}
                    className={cn(
                      'flex items-center justify-between p-2 rounded-md bg-background',
                      tx.status === 'voided' && 'opacity-60 bg-muted/50'
                    )}
                  >
                    <div
                      className={cn(
                        'flex-grow',
                        tx.status === 'voided' && 'line-through'
                      )}
                    >
                      <p className="font-medium">
                        Receipt #{tx.receiptNumber}
                        {tx.customerName && (
                          <span className="text-sm text-muted-foreground">
                            {' '}
                            - {tx.customerName}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tx.items.length} items &bull; Total: ₱
                        {tx.total.toFixed(2)}
                      </p>
                    </div>
                    {tx.status === 'voided' ? (
                      <Badge variant="destructive">Voided</Badge>
                    ) : (
                      <div className="flex items-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="text-primary"
                        >
                          <Link
                            href={`/print/receipt/${tx.id}`}
                            target="_blank"
                          >
                            <Printer className="mr-2 w-4 h-4" /> Print
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setVoidingTransaction(tx)}
                        >
                          <Trash2 className="mr-2 w-4 h-4 text-destructive" />
                          Void
                        </Button>
                      </div>
                    )}
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
                View Sales Transaction History
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      <AlertDialog
        open={!!voidingTransaction}
        onOpenChange={(open) => !open && setVoidingTransaction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently void transaction #
              {voidingTransaction?.receiptNumber}. The stock for all items
              will be restored. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleVoidTransaction}
              disabled={isVoiding}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isVoiding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, Void Transaction
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isItemDeleteAlertOpen}
        onOpenChange={setIsItemDeleteAlertOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Item?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this item from the sale?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDeleteIndex(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteItem}
              className="bg-destructive hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
