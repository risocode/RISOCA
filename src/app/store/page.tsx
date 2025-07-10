
'use client';

import React, {useState, useEffect, useMemo, useRef} from 'react';
import Link from 'next/link';
import {useForm, useWatch, useFieldArray} from 'react-hook-form';
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
import {Label} from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import {useToast} from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
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
  Zap,
  Phone,
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

const SaleItemSchema = z.object({
  itemId: z.string().optional(),
  itemName: z.string().min(1, 'Item name is required.'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1.'),
  unitPrice: z.coerce.number().min(0, 'Price cannot be negative.'),
  total: z.coerce.number(),
});

const SaleFormSchema = z.object({
  items: z.array(SaleItemSchema).min(1, 'Please add at least one item.'),
});

type SaleFormData = z.infer<typeof SaleFormSchema>;

export default function StorePage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [receiptItems, setReceiptItems] = useState<SaleItem[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<
    SaleTransaction[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [receivedMoney, setReceivedMoney] = useState('');
  const [voidingTransaction, setVoidingTransaction] =
    useState<SaleTransaction | null>(null);
  const {toast} = useToast();
  const [popoverStates, setPopoverStates] = useState<Record<number, boolean>>(
    {}
  );
  const [isItemDeleteAlertOpen, setIsItemDeleteAlertOpen] = useState(false);
  const [itemToDeleteIndex, setItemToDeleteIndex] = useState<number | null>(
    null
  );
  const commandInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<SaleFormData>({
    resolver: zodResolver(SaleFormSchema),
    defaultValues: {
      items: [],
    },
  });

  const {fields, append, remove, update} = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const formItems = useWatch({control: form.control, name: 'items'});

  useEffect(() => {
    formItems.forEach((item, index) => {
      const isServiceFee = item.itemName === 'Service Fee';
      const cashInItem = isServiceFee
        ? formItems.find(
            (i) => i.itemName === 'Gcash Cash-In' && i.unitPrice > 0
          )
        : null;

      let newTotal: number;

      if (isServiceFee) {
        newTotal = (cashInItem?.unitPrice || 0) * 0.02;
      } else {
        newTotal = (item.quantity || 0) * (item.unitPrice || 0);
      }

      const roundedNewTotal = Math.round(newTotal * 100) / 100;
      if (item.total !== roundedNewTotal) {
        update(index, {...item, total: roundedNewTotal});
      }
    });
  }, [formItems, update]);

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

  const handleAddItemsToSale = (data: SaleFormData) => {
    const validItems = data.items.filter(
      (item) => item.itemName && item.quantity > 0 && item.total >= 0
    );

    if (validItems.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No items to add',
        description: 'Please fill out at least one item.',
      });
      return;
    }

    setReceiptItems((prev) => [...prev, ...validItems]);
    form.reset({items: []});
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
      setReceivedMoney('');
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

  const handleAddNewItemRow = () => {
    const newIndex = fields.length;
    append({itemName: '', quantity: 1, unitPrice: 0, total: 0});
    setTimeout(() => {
      setPopoverStates((prev) => ({...prev, [newIndex]: true}));
    }, 50);
  };

  const handleAddELoad = () => {
    append({itemName: 'E-Load', quantity: 1, unitPrice: 0, total: 0});
  };

  const handleAddGcash = () => {
    append({itemName: 'Gcash Cash-In', quantity: 1, unitPrice: 0, total: 0});
    append({itemName: 'Service Fee', quantity: 1, unitPrice: 0, total: 0});
  };

  const grandTotal = receiptItems.reduce((acc, item) => acc + item.total, 0);

  const change = useMemo(() => {
    const received = parseFloat(receivedMoney);
    if (!isNaN(received) && received >= grandTotal) {
      return received - grandTotal;
    }
    return null;
  }, [receivedMoney, grandTotal]);

  const formatCurrency = (value: number) =>
    `₱${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <>
      <div className="p-4 md:p-6 space-y-6 opacity-0 animate-page-enter">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Record Sale</CardTitle>
            <CardDescription>
              Add items to build the transaction receipt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleAddItemsToSale)}
                className="space-y-4"
              >
                <Input
                  placeholder="Customer Name (Optional)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="flex-grow"
                />

                <div className="space-y-2">
                  {fields.length > 0 && (
                    <div className="grid grid-cols-[1fr_90px_110px_auto] items-center gap-x-2 px-1 pb-1 text-sm font-medium text-muted-foreground">
                      <Label>Item</Label>
                      <Label className="text-center">Qty</Label>
                      <Label className="text-center">Price</Label>
                    </div>
                  )}
                  {fields.map((field, index) => {
                    const currentItemName = form.watch(
                      `items.${index}.itemName`
                    );
                    const isServiceFee = currentItemName === 'Service Fee';
                    const isELoad = currentItemName === 'E-Load';
                    const isGcash = currentItemName === 'Gcash Cash-In';
                    const isSpecialItem = isServiceFee || isELoad || isGcash;

                    if (isServiceFee) {
                      return (
                        <div
                          key={field.id}
                          className="flex items-center gap-2 p-2 bg-muted rounded-md"
                        >
                          <p className="flex-1 font-medium text-sm">
                            Service Fee
                          </p>
                          <p className="font-mono text-sm">
                            {formatCurrency(
                              form.getValues(`items.${index}.total`)
                            )}
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={field.id}
                        className="grid grid-cols-[1fr_90px_110px_auto] items-start gap-2"
                      >
                        {isSpecialItem ? (
                          <div className="flex h-10 items-center rounded-md border border-input bg-background px-3 py-2 text-sm font-semibold">
                            {currentItemName}
                          </div>
                        ) : (
                          <FormField
                            name={`items.${index}.itemName`}
                            control={form.control}
                            render={({field: formField}) => (
                              <FormItem>
                                <Popover
                                  open={popoverStates[index] ?? false}
                                  onOpenChange={(open) => {
                                    setPopoverStates((prev) => ({
                                      ...prev,
                                      [index]: open,
                                    }));
                                    if (open) {
                                      setTimeout(() => {
                                        commandInputRef.current?.focus();
                                      }, 100);
                                    }
                                  }}
                                >
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        variant="outline"
                                        role="combobox"
                                        className={cn(
                                          'w-full justify-between h-10',
                                          !formField.value &&
                                            'text-muted-foreground'
                                        )}
                                      >
                                        {formField.value || 'Select item'}
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
                                        ref={commandInputRef}
                                        placeholder="Search inventory..."
                                      />
                                      <CommandList>
                                        <CommandEmpty>
                                          No item found.
                                        </CommandEmpty>
                                        <CommandGroup>
                                          {inventory.map((item) => (
                                            <CommandItem
                                              value={item.name}
                                              key={item.id}
                                              onSelect={() => {
                                                update(index, {
                                                  ...form.getValues(
                                                    `items.${index}`
                                                  ),
                                                  itemName: item.name,
                                                  unitPrice: item.price,
                                                  itemId: item.id,
                                                });
                                                setPopoverStates((prev) => ({
                                                  ...prev,
                                                  [index]: false,
                                                }));
                                              }}
                                            >
                                              <Check
                                                className={cn(
                                                  'mr-2 h-4 w-4',
                                                  formField.value === item.name
                                                    ? 'opacity-100'
                                                    : 'opacity-0'
                                                )}
                                              />
                                              {item.name}
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              </FormItem>
                            )}
                          />
                        )}

                        <FormField
                          name={`items.${index}.quantity`}
                          control={form.control}
                          render={({field: formField}) => (
                            <FormItem>
                              <FormControl>
                                <div className="relative">
                                  <Input
                                    type="number"
                                    placeholder="Qty"
                                    {...formField}
                                    className="pr-12 text-center no-spinners"
                                    onChange={(e) =>
                                      formField.onChange(
                                        parseInt(e.target.value, 10) || 1
                                      )
                                    }
                                    min="1"
                                    disabled={isSpecialItem}
                                  />
                                  {!isSpecialItem && (
                                    <div className="absolute inset-y-0 right-0 flex items-center">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-full w-6"
                                        onClick={() =>
                                          formField.onChange(
                                            Math.max(
                                              1,
                                              (formField.value || 1) - 1
                                            )
                                          )
                                        }
                                        disabled={formField.value <= 1}
                                      >
                                        <Minus className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-full w-6"
                                        onClick={() =>
                                          formField.onChange(
                                            (formField.value || 0) + 1
                                          )
                                        }
                                      >
                                        <Plus className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          name={`items.${index}.unitPrice`}
                          control={form.control}
                          render={({field: formField}) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="Price"
                                  {...formField}
                                  className="no-spinners text-right"
                                  disabled={isServiceFee}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between items-center mt-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddNewItemRow}
                    >
                      <Plus className="mr-2" /> Add Item
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddELoad}
                    >
                      <Phone className="mr-2" /> E-Load
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddGcash}
                    >
                      <Zap className="mr-2" /> Gcash
                    </Button>
                  </div>
                  {fields.length > 0 && (
                    <Button type="submit" size="sm">
                      <PlusCircle className="mr-2" /> Add to Sale
                    </Button>
                  )}
                </div>
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
              <div className="space-y-4 px-2">
                <div className="flex justify-between items-baseline">
                  <p className="text-lg font-bold">Total:</p>
                  <p className="text-2xl font-bold font-mono">
                    {formatCurrency(grandTotal)}
                  </p>
                </div>
                <div className="grid grid-cols-2 items-center gap-4">
                  <Label htmlFor="received-money" className="text-base">
                    Received Money:
                  </Label>
                  <Input
                    id="received-money"
                    type="number"
                    placeholder="0.00"
                    className="text-right text-base no-spinners"
                    value={receivedMoney}
                    onChange={(e) => setReceivedMoney(e.target.value)}
                  />
                </div>
                {change !== null && (
                  <div className="flex justify-between items-baseline text-lg text-primary">
                    <p className="font-bold">Change:</p>
                    <p className="font-bold font-mono">
                      {formatCurrency(change)}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex-col items-center justify-center p-4 text-center text-xs text-muted-foreground">
              <p>Thank you for your business!</p>
            </CardFooter>
          </Card>
        )}

        {receiptItems.length > 0 && (
          <Button
            size="lg"
            className="w-full"
            onClick={handleFinalSubmit}
            disabled={isSubmitting || receiptItems.length === 0}
          >
            {isSubmitting && <Loader2 className="mr-2 animate-spin" />}
            Submit Sale
          </Button>
        )}

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
              {voidingTransaction?.receiptNumber}. The stock for all items will
              be restored. This action cannot be undone.
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
