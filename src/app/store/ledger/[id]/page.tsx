
'use client';

import {useState, useEffect, useMemo} from 'react';
import Link from 'next/link';
import {useParams, useRouter} from 'next/navigation';
import {useForm, useWatch, useFieldArray} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import {
  collection,
  query,
  onSnapshot,
  doc,
  where,
  orderBy
} from 'firebase/firestore';
import {db} from '@/lib/firebase';
import {
  addLedgerTransaction,
  deleteLedgerTransaction,
  deleteCustomer,
  updateCustomerName,
} from '@/app/actions';
import {
  LedgerTransactionSchema,
  type Customer,
  type LedgerTransaction,
  type LedgerTransactionInput,
  SaleItemSchema,
  type InventoryItem
} from '@/lib/schemas';

import {
  Card,
  CardContent,
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {Button} from '@/components/ui/button';
import {useToast} from '@/hooks/use-toast';
import {
  ArrowLeft,
  Trash2,
  Loader2,
  Plus,
  Minus,
  Pencil,
  Info,
  PlusCircle,
  ChevronsUpDown,
  Check
} from 'lucide-react';
import {Skeleton} from '@/components/ui/skeleton';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {Tabs, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {Badge} from '@/components/ui/badge';
import {Checkbox} from '@/components/ui/checkbox';
import {format} from 'date-fns';
import {cn} from '@/lib/utils';
import {Label} from '@/components/ui/label';
import {ScrollArea} from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {Separator} from '@/components/ui/separator';
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList} from '@/components/ui/command';


const TransactionFormSchema = LedgerTransactionSchema.omit({customerId: true}).extend({
  items: z.array(SaleItemSchema).optional()
});
type TransactionFormData = z.infer<typeof TransactionFormSchema>;

export default function CustomerLedgerPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;
  const {toast} = useToast();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [alertAction, setAlertAction] = useState<'deleteTransaction' | 'deleteCustomer' | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedCredits, setSelectedCredits] = useState<Set<string>>(new Set());

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(TransactionFormSchema),
    defaultValues: {
      type: 'credit',
      amount: 0,
      description: '',
      items: [],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "items",
  });
  
  const formType = useWatch({ control: form.control, name: 'type' });
  const formItems = useWatch({ control: form.control, name: 'items' });

  useEffect(() => {
    if (formType === 'credit' && formItems && formItems.length > 0) {
      const total = formItems.reduce((sum, item) => sum + (item.total || 0), 0);
      form.setValue('amount', total, { shouldValidate: true });
    }
  }, [formItems, formType, form]);

  useEffect(() => {
    // Reset fields when switching transaction type
    replace([{ itemName: '', quantity: 1, unitPrice: 0, total: 0 }]);
    form.setValue('amount', 0);
    form.setValue('description', '');
    setSelectedCredits(new Set());
  }, [formType, replace, form]);

  useEffect(() => {
    if (!customerId) return;
    setIsLoading(true);

    const unsubCustomer = onSnapshot(
      doc(db, 'customers', customerId),
      (doc) => {
        if (doc.exists()) {
          const customerData = {id: doc.id, ...doc.data()} as Customer;
          setCustomer(customerData);
          if (customerData.status === 'deleted') {
             toast({
              variant: 'destructive',
              title: 'Customer Deleted',
              duration: 2000,
            });
          }
        } else {
          toast({
            variant: 'destructive',
            title: 'Customer not found.',
            duration: 1000,
          });
          router.push('/store/ledger');
        }
      }
    );

    const transQuery = query(
      collection(db, 'ledger'),
      where('customerId', '==', customerId)
    );
    const unsubTransactions = onSnapshot(transQuery, (snapshot) => {
      const transData = snapshot.docs.map(
        (doc) => ({id: doc.id, ...doc.data()} as LedgerTransaction)
      );
      transData.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime();
      });
      setTransactions(transData);
    });

    const inventoryQuery = query(
      collection(db, 'inventory'),
      orderBy('name', 'asc')
    );
    const unsubInventory = onSnapshot(inventoryQuery, (snapshot) => {
        setInventory(
          snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()} as InventoryItem))
        );
    });

    Promise.all([unsubCustomer, unsubTransactions, unsubInventory]).then(() => {
        setIsLoading(false);
    });

    return () => {
      unsubCustomer();
      unsubTransactions();
      unsubInventory();
    };
  }, [customerId, router, toast]);

  const {balance, totalCredit, totalPaid} = useMemo(() => {
    let credit = 0;
    let payment = 0;
    transactions
      .filter((tx) => tx.status !== 'deleted')
      .forEach((tx) => {
        if (tx.type === 'credit') {
          credit += tx.amount;
        } else {
          payment += tx.amount;
        }
      });
    const balance = credit - payment;
    return {balance, totalCredit: credit, totalPaid: payment};
  }, [transactions]);
  
  const paidCreditIds = useMemo(() => {
    const ids = new Set<string>();
    transactions.forEach(tx => {
        if (tx.type === 'payment' && tx.paidCreditIds) {
            tx.paidCreditIds.forEach(id => ids.add(id));
        }
    });
    return ids;
  }, [transactions]);

  const outstandingCreditTransactions = useMemo(() => {
    return transactions
      .filter((tx) => tx.type === 'credit' && !paidCreditIds.has(tx.id) && tx.status !== 'deleted')
      .sort((a, b) => a.createdAt.toDate().getTime() - b.createdAt.toDate().getTime());
  }, [transactions, paidCreditIds]);


  useEffect(() => {
    if (formType === 'credit') {
      if (selectedCredits.size > 0) {
        setSelectedCredits(new Set());
      }
      return;
    }

    const selectedTxs = outstandingCreditTransactions.filter(tx => selectedCredits.has(tx.id));
    const total = selectedTxs.reduce((sum, tx) => sum + tx.amount, 0);

    if (selectedTxs.length > 0) {
      form.setValue('amount', total, { shouldValidate: true });
      const description = `Payment for: ${selectedTxs.map(tx => tx.description || `Credit on ${format(tx.createdAt.toDate(), 'PP')}`).join(', ')}`;
      form.setValue('description', description);
    }
  }, [selectedCredits, outstandingCreditTransactions, form, formType]);


  const handleCreditSelection = (txId: string) => {
    setSelectedCredits(prev => {
        const newSelection = new Set(prev);
        if (newSelection.has(txId)) {
            newSelection.delete(txId);
        } else {
            newSelection.add(txId);
        }
        return newSelection;
    });
  };

  const handleFormSubmit = async (data: TransactionFormData) => {
    setIsSubmitting(true);
    
    if (data.type === 'credit' && (!data.items || data.items.length === 0 || !data.items[0].itemName)) {
       toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please add at least one item for a credit transaction.',
      });
      setIsSubmitting(false);
      return;
    }

    let autoDescription = data.description;
    if (data.type === 'credit' && data.items && data.items.length > 0) {
      autoDescription = data.items.map(item => item.itemName).join(', ');
    }

    const payload: LedgerTransactionInput = {
      customerId,
      type: data.type,
      amount: data.amount,
      description: autoDescription,
      items: data.items,
      paidCreditIds: data.type === 'payment' && selectedCredits.size > 0 ? Array.from(selectedCredits) : undefined,
    };

    const response = await addLedgerTransaction(payload);

    if (response.success) {
      toast({
        variant: 'success',
        title: 'Transaction Added',
      });
      form.reset({
        type: data.type,
        amount: 0,
        description: '',
        items: []
      });
      replace([{ itemName: '', quantity: 1, unitPrice: 0, total: 0 }]);
      setSelectedCredits(new Set());
      setIsSheetOpen(false);
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: response.message || 'An unknown error occurred.',
      });
    }
    setIsSubmitting(false);
  };

  const openDeleteAlert = (action: 'deleteTransaction' | 'deleteCustomer', id?: string) => {
      setAlertAction(action);
      if(id) setDeletingId(id);
      setIsAlertOpen(true);
  }

  const handleConfirmDelete = async () => {
    if(!alertAction) return;
    setIsDeleting(true);
    let response;
    if (alertAction === 'deleteTransaction' && deletingId) {
      response = await deleteLedgerTransaction(deletingId);
    } else if (alertAction === 'deleteCustomer') {
      response = await deleteCustomer(customerId);
    }
    
    if (response?.success) {
      if (alertAction === 'deleteCustomer') {
        toast({
          variant: 'destructive',
          title: 'Customer Deleted',
        });
        router.push('/store/ledger');
      } else {
        toast({
          variant: 'destructive',
          title: 'Transaction Deleted',
        });
      }
    } else {
      toast({variant: 'destructive', title: 'Error', description: response?.message || 'An error occurred.'});
    }

    setIsDeleting(false);
    setIsAlertOpen(false);
    setAlertAction(null);
    setDeletingId(null);
  };

  const handleOpenEditModal = () => {
    if (customer) {
      setNewName(customer.name);
      setIsEditModalOpen(true);
    }
  };

  const handleNameUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    setIsUpdatingName(true);

    const response = await updateCustomerName(customer.id, newName);

    if (response.success) {
      toast({
        variant: 'success',
        title: 'Name Updated',
      });
      setIsEditModalOpen(false);
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: response.message || 'An error occurred.',
      });
    }
    setIsUpdatingName(false);
  };
  
  const formatCurrency = (value: number) =>
    `₱${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const cannotDeleteCustomer = balance !== 0 || customer?.status === 'deleted';

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <Card><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent><Skeleton className="h-40 w-full" /></CardContent></Card>
      </div>
    );
  }

  return (
    <>
    <div className="flex flex-1 flex-col p-4 md:p-6 space-y-6 opacity-0 animate-page-enter">
       <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
           <Button asChild variant="outline" size="icon" className="flex-shrink-0">
            <Link href="/store/ledger">
              <ArrowLeft />
              <span className="sr-only">Back to Ledger</span>
            </Link>
          </Button>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold truncate">{customer?.name}</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleOpenEditModal}
              disabled={customer?.status === 'deleted'}
            >
              <Pencil className="h-5 w-5" />
              <span className="sr-only">Edit Name</span>
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openDeleteAlert('deleteCustomer')}
                      disabled={cannotDeleteCustomer}
                      className={cannotDeleteCustomer ? 'pointer-events-none' : ''}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete Customer
                    </Button>
                  </span>
                </TooltipTrigger>
                {cannotDeleteCustomer && (
                  <TooltipContent>
                    <p>{customer?.status === 'deleted' ? 'Customer is already deleted.' : 'Cannot delete customer with an outstanding balance.'}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
        </div>
      </header>

      <Card className="shadow-lg text-secondary-foreground bg-secondary">
        <Collapsible onOpenChange={setIsInfoOpen}>
          <div className="relative p-6">
            <div className="flex flex-col items-center justify-center min-h-[120px]">
              <CardTitle className="text-lg font-normal text-secondary-foreground/80">
                Outstanding Balance
              </CardTitle>
              <p className={cn('text-5xl font-bold tracking-tighter !mt-2', balance > 0 ? 'text-destructive' : 'text-success')}>
                {formatCurrency(balance)}
              </p>
            </div>
            
            <CollapsibleContent>
              <Separator className="my-4 bg-border/20" />
              <div className="flex justify-between text-sm">
                <div>
                  <p className="text-secondary-foreground/80">Total Credit</p>
                  <p className="font-semibold text-destructive">{formatCurrency(totalCredit)}</p>
                </div>
                <div className="text-right">
                  <p className="text-secondary-foreground/80">Total Paid</p>
                  <p className="font-semibold text-success">{formatCurrency(totalPaid)}</p>
                </div>
              </div>
            </CollapsibleContent>
            
            <div className="mt-4 flex justify-center">
              <CollapsibleTrigger asChild>
                <Button variant="link" className="text-secondary-foreground/80 hover:text-secondary-foreground">
                  {isInfoOpen ? 'Less Info' : 'More Info'}
                  <Info className="ml-2 h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </Collapsible>
      </Card>
      
      <Card>
          <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>A complete log of all credits and payments for this customer.</CardDescription>
          </CardHeader>
          <CardContent>
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-center">Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-center">Action</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {transactions.length > 0 ? (
                          transactions.map((tx) => (
                              <TableRow key={tx.id} className={cn(tx.status === 'deleted' && "opacity-50")}>
                                  <TableCell className={cn(tx.status === 'deleted' && 'line-through')}>{format(tx.createdAt.toDate(), 'PP')}</TableCell>
                                  <TableCell className="text-center">
                                      {tx.status === 'deleted' ? <Badge variant="destructive">Deleted</Badge> : <Badge variant={tx.type === 'credit' ? 'destructive' : 'success'}>{tx.type}</Badge>}
                                  </TableCell>
                                  <TableCell className={cn("max-w-[200px] truncate", tx.status === 'deleted' && 'line-through')}>{tx.description || (tx.items ? `${tx.items.length} items` : "Payment")}</TableCell>
                                  <TableCell className={cn("text-right font-mono", tx.status === 'deleted' && 'line-through')}>{formatCurrency(tx.amount)}</TableCell>
                                  <TableCell className="text-center">
                                      <Button variant="ghost" size="icon" onClick={() => openDeleteAlert('deleteTransaction', tx.id)} disabled={tx.status === 'deleted'}>
                                          <Trash2 className="w-4 h-4 text-destructive"/>
                                      </Button>
                                  </TableCell>
                              </TableRow>
                          ))
                      ) : (
                          <TableRow>
                              <TableCell colSpan={5} className="h-24 text-center">
                                  No transactions yet for this customer.
                              </TableCell>
                          </TableRow>
                      )}
                  </TableBody>
              </Table>
          </CardContent>
      </Card>
    </div>
    
    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetTrigger asChild>
            <Button className="fixed bottom-24 right-6 h-16 w-16 rounded-full shadow-2xl" size="icon">
                <Plus className="h-8 w-8" />
                <span className="sr-only">New Transaction</span>
            </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-2xl sm:max-w-2xl mx-auto border-none bg-card p-0">
            <SheetHeader className="p-6">
                <SheetTitle>New Transaction</SheetTitle>
                <SheetDescription>Add a credit or payment to this customer's account.</SheetDescription>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="p-6 pt-0">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
                        <Tabs defaultValue="credit" onValueChange={(value) => form.setValue('type', value as 'credit' | 'payment')} className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger
                                    value="credit"
                                    className="gap-2 data-[state=active]:bg-destructive/20 data-[state=active]:text-destructive-foreground data-[state=active]:shadow-inner"
                                >
                                    <Plus className="h-4 w-4" />Credit
                                </TabsTrigger>
                                <TabsTrigger
                                    value="payment"
                                    className="gap-2 data-[state=active]:bg-success/20 data-[state=active]:text-success-foreground data-[state=active]:shadow-inner"
                                >
                                    <Minus className="h-4 w-4" />Payment
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>

                         {formType === 'credit' ? (
                            <div className="space-y-4">
                                <Label>Items</Label>
                                <div className="space-y-2">
                                {fields.map((field, index) => {
                                  const currentItemName = form.watch(`items.${index}.itemName`);
                                  return (
                                    <div key={field.id} className="flex items-start gap-2">
                                      <div className="flex-grow">
                                        <FormField
                                            name={`items.${index}.itemName`}
                                            control={form.control}
                                            render={({ field: formField }) => (
                                            <FormItem>
                                              <Popover>
                                                <PopoverTrigger asChild>
                                                  <FormControl>
                                                    <Button variant="outline" role="combobox" className={cn("w-full justify-between", !formField.value && "text-muted-foreground")}>
                                                      {formField.value || "Select or type an item"}
                                                      <ChevronsUpDown className="w-4 h-4 ml-2 opacity-50 shrink-0" />
                                                    </Button>
                                                  </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                  <Command filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}>
                                                    <CommandInput placeholder="Search inventory..." onValueChange={(search) => form.setValue(`items.${index}.itemName`, search)} />
                                                    <CommandList>
                                                      <CommandEmpty>No item found.</CommandEmpty>
                                                      <CommandGroup>
                                                        {inventory.map((item) => (
                                                          <CommandItem value={item.name} key={item.id} onSelect={() => {
                                                            form.setValue(`items.${index}.itemId`, item.id);
                                                            form.setValue(`items.${index}.itemName`, item.name);
                                                            form.setValue(`items.${index}.unitPrice`, item.price);
                                                            form.setValue(`items.${index}.quantity`, 1);
                                                            const qty = form.getValues(`items.${index}.quantity`);
                                                            form.setValue(`items.${index}.total`, item.price * (qty || 1));
                                                          }}>
                                                            <Check className={cn("mr-2 h-4 w-4", formField.value === item.name ? "opacity-100" : "opacity-0")} />
                                                            <span>{item.name}</span><span className="ml-auto text-xs text-muted-foreground">Stock: {item.stock}</span>
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
                                      </div>
                                      
                                      {currentItemName && (
                                        <>
                                            <FormField
                                                name={`items.${index}.quantity`}
                                                control={form.control}
                                                render={({ field: formField }) => (
                                                <FormItem className="w-24">
                                                    <FormControl>
                                                        <div className="relative">
                                                          <Input type="number" placeholder="Qty" {...formField} className="pr-16 text-center no-spinners" onChange={(e) => {
                                                            const qty = parseInt(e.target.value, 10) || 0;
                                                            const price = form.getValues(`items.${index}.unitPrice`);
                                                            formField.onChange(qty);
                                                            form.setValue(`items.${index}.total`, (price || 0) * qty);
                                                          }} />
                                                          <div className="absolute inset-y-0 right-0.5 flex items-center">
                                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => formField.onChange(Math.max(1, (formField.value || 1) - 1))} disabled={formField.value <= 1}><Minus className="h-4 w-4" /></Button>
                                                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => formField.onChange((formField.value || 0) + 1)}><Plus className="h-4 w-4" /></Button>
                                                          </div>
                                                        </div>
                                                    </FormControl>
                                                </FormItem>
                                                )}
                                            />
                                            <FormField
                                                name={`items.${index}.unitPrice`}
                                                control={form.control}
                                                render={({ field: formField }) => (
                                                <FormItem className="flex-grow">
                                                    <FormControl>
                                                      <Input type="number" step="0.01" placeholder="Price" {...formField} className="no-spinners" onChange={(e) => {
                                                          const price = parseFloat(e.target.value) || 0;
                                                          const qty = form.getValues(`items.${index}.quantity`);
                                                          formField.onChange(price);
                                                          form.setValue(`items.${index}.total`, price * (qty || 0));
                                                      }}/>
                                                    </FormControl>
                                                </FormItem>
                                                )}
                                            />
                                        </>
                                      )}
                                      <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                                    </div>
                                  )
                                })}
                                <Button type="button" variant="outline" size="sm" onClick={() => append({ itemName: '', quantity: 1, unitPrice: 0, total: 0 })}><PlusCircle className="mr-2" /> Add Item</Button>
                                </div>
                                <Separator />
                                <FormField control={form.control} name="amount" render={({field}) => (
                                    <FormItem><FormLabel>Total Amount (₱)</FormLabel><FormControl>
                                        <Input type="number" step="0.01" {...field} disabled className="font-bold text-lg" />
                                    </FormControl><FormMessage/></FormItem>
                                )}/>
                            </div>
                        ) : (
                            <>
                                <FormField control={form.control} name="amount" render={({field}) => (
                                    <FormItem><FormLabel>Amount (₱)</FormLabel><FormControl>
                                        <Input type="number" step="0.01" {...field} onChange={(e) => {
                                            field.onChange(e.target.valueAsNumber);
                                            if (selectedCredits.size > 0) {
                                            setSelectedCredits(new Set());
                                            form.setValue('description', '');
                                            }
                                        }}/>
                                    </FormControl><FormMessage/></FormItem>
                                )}/>
                                <FormField control={form.control} name="description" render={({field}) => (
                                    <FormItem><FormLabel>Description</FormLabel><FormControl>
                                        <Textarea placeholder="e.g., Payment for invoice #123" {...field}/>
                                    </FormControl><FormMessage/></FormItem>
                                )}/>
                                <div className="space-y-2">
                                    <FormLabel>Pay off specific credits (optional)</FormLabel>
                                    <Card className="max-h-60 overflow-y-auto">
                                        <CardContent className="p-2">
                                        {outstandingCreditTransactions.length > 0 ? (
                                            outstandingCreditTransactions.map(tx => (
                                                <div
                                                key={tx.id}
                                                className="flex items-center space-x-3 p-2 rounded-md transition-colors hover:bg-muted has-[:checked]:bg-primary/10"
                                                >
                                                    <Checkbox
                                                        id={`credit-${tx.id}`}
                                                        checked={selectedCredits.has(tx.id)}
                                                        onCheckedChange={() => handleCreditSelection(tx.id)}
                                                    />
                                                    <label
                                                        htmlFor={`credit-${tx.id}`}
                                                        className="flex justify-between items-center w-full text-sm font-normal cursor-pointer"
                                                    >
                                                        <div>
                                                            <p className="font-medium">{tx.description || 'Credit'}</p>
                                                            <p className="text-xs text-muted-foreground">{format(tx.createdAt.toDate(), 'PP')}</p>
                                                        </div>
                                                        <span className="font-mono">{formatCurrency(tx.amount)}</span>
                                                    </label>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-muted-foreground text-center p-4">
                                                No outstanding credits found.
                                            </p>
                                        )}
                                        </CardContent>
                                    </Card>
                                </div>
                            </>
                         )}

                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                            <SheetClose asChild>
                                <Button type="button" variant="secondary">Cancel</Button>
                            </SheetClose>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 animate-spin" />}
                                {formType === 'payment' ? 'Record Payment' : 'Add Credit'}
                            </Button>
                        </div>
                    </form>
                </Form>
              </div>
            </ScrollArea>
        </SheetContent>
    </Sheet>

    <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {alertAction === 'deleteCustomer'
                ? 'Confirm Customer Deletion'
                : 'Confirm Transaction Deletion'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {alertAction === 'deleteCustomer' 
                ? "This will permanently delete this customer and all of their associated transactions. This action cannot be undone."
                : "This will permanently delete this transaction and restore any associated product stock. This action cannot be undone."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsAlertOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Customer Name</DialogTitle>
                <DialogDescription>
                    Update the name for this customer. This will not affect past records.
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleNameUpdate} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="customerName">Customer Name</Label>
                    <Input
                        id="customerName"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        required
                    />
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">Cancel</Button>
                    </DialogClose>
                    <Button type="submit" disabled={isUpdatingName}>
                        {isUpdatingName && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
