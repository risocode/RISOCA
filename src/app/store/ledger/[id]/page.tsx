
'use client';

import * as React from 'react';
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
  orderBy,
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
  type InventoryItem,
} from '@/lib/schemas';

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
  ChevronsUpDown,
  Check,
  Package,
  DollarSign,
  ChevronDown,
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
import {Tabs, TabsList, TabsContent, TabsTrigger} from '@/components/ui/tabs';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

const TransactionFormSchema = LedgerTransactionSchema.omit({
  customerId: true,
}).extend({
  items: z.array(SaleItemSchema).optional(),
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

  const [isCustomerLoading, setIsCustomerLoading] = useState(true);
  const [isInventoryLoading, setIsInventoryLoading] = useState(true);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [
    alertAction,
    setAlertAction,
  ] = useState<'deleteTransaction' | 'deleteCustomer' | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedCredits, setSelectedCredits] = useState<Set<string>>(
    new Set()
  );

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [popoverStates, setPopoverStates] = useState<Record<number, boolean>>(
    {}
  );
  const [openTransaction, setOpenTransaction] = useState<string | null>(null);

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(TransactionFormSchema),
    defaultValues: {
      type: 'credit',
      amount: 0,
      description: '',
      items: [],
    },
  });

  const {fields, append, remove, update} = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const formType = useWatch({control: form.control, name: 'type'});
  const formItems = useWatch({control: form.control, name: 'items'});

  useEffect(() => {
    if (!customerId) return;

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
        setIsCustomerLoading(false);
      },
      (error) => {
        console.error('Error fetching customer:', error);
        setIsCustomerLoading(false);
      }
    );

    const transQuery = query(
      collection(db, 'ledger'),
      where('customerId', '==', customerId)
    );
    const unsubTransactions = onSnapshot(
      transQuery,
      (snapshot) => {
        const transData = snapshot.docs.map(
          (doc) => ({id: doc.id, ...doc.data()} as LedgerTransaction)
        );
        transData.sort((a, b) => {
          if (!a.createdAt || !b.createdAt) return 0;
          return (
            b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime()
          );
        });
        setTransactions(transData);
        setIsTransactionsLoading(false);
      },
      (error) => {
        console.error('Error fetching transactions:', error);
        setIsTransactionsLoading(false);
      }
    );

    const inventoryQuery = query(
      collection(db, 'inventory'),
      orderBy('name', 'asc')
    );
    const unsubInventory = onSnapshot(
      inventoryQuery,
      (snapshot) => {
        setInventory(
          snapshot.docs.map(
            (doc) => ({id: doc.id, ...doc.data()} as InventoryItem)
          )
        );
        setIsInventoryLoading(false);
      },
      (error) => {
        console.error('Error fetching inventory:', error);
        setIsInventoryLoading(false);
      }
    );

    return () => {
      unsubCustomer();
      unsubTransactions();
      unsubInventory();
    };
  }, [customerId, router, toast]);

  useEffect(() => {
    if (!isCustomerLoading && !isTransactionsLoading && !isInventoryLoading) {
      setIsLoading(false);
    }
  }, [isCustomerLoading, isTransactionsLoading, isInventoryLoading]);

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
    transactions.forEach((tx) => {
      if (tx.type === 'payment' && tx.paidCreditIds) {
        tx.paidCreditIds.forEach((id) => ids.add(id));
      }
    });
    return ids;
  }, [transactions]);

  const outstandingCreditTransactions = useMemo(() => {
    return transactions
      .filter(
        (tx) =>
          tx.type === 'credit' &&
          !paidCreditIds.has(tx.id) &&
          tx.status !== 'deleted'
      )
      .sort(
        (a, b) =>
          a.createdAt.toDate().getTime() - b.createdAt.toDate().getTime()
      );
  }, [transactions, paidCreditIds]);

  const sortedFields = useMemo(() => {
    const fieldsWithOriginalIndex = fields.map((field, index) => ({
      ...field,
      originalIndex: index,
    }));
    const itemFields = fieldsWithOriginalIndex.filter(f => !f.itemId && f.itemName !== 'Cash' || (f.itemId && f.itemName !== 'Cash'));
    const cashFields = fieldsWithOriginalIndex.filter(f => f.itemName === 'Cash');
    return [...itemFields, ...cashFields];
  }, [fields]);

  const hasProductItems = useMemo(() => {
    return fields.some((f) => f.itemId && f.itemName !== 'Cash');
  }, [fields]);

  useEffect(() => {
    const totalAmount =
      formItems?.reduce((sum, item) => sum + (item.total || 0), 0) || 0;
    form.setValue('amount', totalAmount, {shouldValidate: false});
  }, [formItems, form]);

  useEffect(() => {
    if (!isSheetOpen) return;
    form.reset({
      type: form.getValues('type'),
      amount: 0,
      description: '',
      items: [],
    });
    setSelectedCredits(new Set());
    form.clearErrors();
    setPopoverStates({});
  }, [isSheetOpen, form]);

  useEffect(() => {
    if (formType === 'credit') {
      return;
    }

    const selectedTxs = outstandingCreditTransactions.filter((tx) =>
      selectedCredits.has(tx.id)
    );
    const total = selectedTxs.reduce((sum, tx) => sum + tx.amount, 0);

    if (selectedTxs.length > 0) {
      form.setValue('amount', total, {shouldValidate: false});
      const description = `Payment for ${selectedTxs.length} outstanding credit${selectedTxs.length > 1 ? 's' : ''}.`;
      form.setValue('description', description);
    }
  }, [selectedCredits, outstandingCreditTransactions, form, formType]);

  const handleCreditSelection = (txId: string) => {
    setSelectedCredits((prev) => {
      const newSelection = new Set(prev);
      if (newSelection.has(txId)) {
        newSelection.delete(txId);
      } else {
        newSelection.add(txId);
      }
      return newSelection;
    });
  };

  const handleSelectAllCredits = () => {
    if (selectedCredits.size === outstandingCreditTransactions.length) {
      setSelectedCredits(new Set());
    } else {
      const allIds = new Set(outstandingCreditTransactions.map((tx) => tx.id));
      setSelectedCredits(allIds);
    }
  };

  const handleFormSubmit = async (data: TransactionFormData) => {
    setIsSubmitting(true);

    if (data.type === 'credit' && (!data.items || data.items.length === 0)) {
      form.setError('items', {
        type: 'manual',
        message: 'Please add at least one item or cash advance.',
      });
      setIsSubmitting(false);
      return;
    }

    if (data.amount === 0 && data.type !== 'credit') {
      form.setError('amount', {
        type: 'manual',
        message: 'Amount must not be 0.',
      });
      setIsSubmitting(false);
      return;
    }

    if (
      data.type === 'credit' &&
      data.amount === 0 &&
      data.items &&
      data.items.length > 0
    ) {
      form.setError('amount', {
        type: 'manual',
        message:
          'Total credit cannot be zero. Please check item prices and quantities.',
      });
      setIsSubmitting(false);
      return;
    }

    let payload: LedgerTransactionInput;

    if (data.type === 'credit') {
      const validItems =
        data.items?.filter(
          (item) =>
            (item.itemName && item.itemName.trim() !== '' && item.total > 0) ||
            (item.itemName === 'Cash' && item.total > 0)
        ) || [];

      if (validItems.length === 0) {
        form.setError('items', {
          type: 'manual',
          message: 'Please add valid items to the credit.',
        });
        setIsSubmitting(false);
        return;
      }

      const itemDescriptions = validItems.map((item) => {
        return item.itemName === 'Cash'
          ? `Cash: ${formatCurrency(item.total)}`
          : `${item.itemName} (x${item.quantity})`;
      });

      let finalDescription = 'Credit Transaction';
      if (itemDescriptions.length > 0) {
        if (itemDescriptions.length <= 2) {
          finalDescription = itemDescriptions.join(', ');
        } else {
          finalDescription = `${itemDescriptions[0]} and ${
            itemDescriptions.length - 1
          } more items`;
        }
      }

      payload = {
        customerId,
        type: 'credit',
        amount: data.amount,
        description: finalDescription,
        items: validItems,
      };
    } else {
      // Payment
      payload = {
        customerId,
        type: 'payment',
        amount: data.amount,
        description: data.description || 'Payment',
        paidCreditIds:
          selectedCredits.size > 0 ? Array.from(selectedCredits) : undefined,
      };
    }

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
        items: [],
      });
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

  const openDeleteAlert = (
    action: 'deleteTransaction' | 'deleteCustomer',
    id?: string
  ) => {
    setAlertAction(action);
    if (id) setDeletingId(id);
    setIsAlertOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!alertAction) return;
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
      toast({
        variant: 'destructive',
        title: 'Error',
        description: response?.message || 'An error occurred.',
      });
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

  const handleRemoveItem = (index: number) => {
    remove(index);
  };

  const handleAddItem = (type: 'item' | 'cash') => {
    if (type === 'item') {
      append({itemName: '', quantity: 1, unitPrice: 0, total: 0});
    } else {
      append({itemName: 'Cash', quantity: 1, unitPrice: 0, total: 0});
    }
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';
    return `₱${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const toggleTransactionRow = (txId: string) => {
    setOpenTransaction((prev) => (prev === txId ? null : txId));
  };


  if (isLoading) {
    return (
      <div className="p-6 space-y-4 flex flex-col h-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading customer data...</p>
      </div>
    );
  }

  const cannotDeleteCustomer =
    balance !== 0 || customer?.status === 'deleted';

  return (
    <>
      <div className="flex flex-1 flex-col p-4 md:p-6 space-y-6 opacity-0 animate-page-enter">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              asChild
              variant="outline"
              size="icon"
              className="flex-shrink-0"
            >
              <Link href="/store/ledger">
                <ArrowLeft />
                <span className="sr-only">Back to Ledger</span>
              </Link>
            </Button>
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold truncate">
                {customer?.name}
              </h1>
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
                      className={
                        cannotDeleteCustomer ? 'pointer-events-none' : ''
                      }
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete Customer
                    </Button>
                  </span>
                </TooltipTrigger>
                {cannotDeleteCustomer && (
                  <TooltipContent>
                    <p>
                      {customer?.status === 'deleted'
                        ? 'Customer is already deleted.'
                        : 'Cannot delete customer with an outstanding balance.'}
                    </p>
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
                <p
                  className={cn(
                    'text-5xl font-bold tracking-tighter !mt-2',
                    balance > 0 ? 'text-destructive' : 'text-success'
                  )}
                >
                  {formatCurrency(balance)}
                </p>
              </div>

              <CollapsibleContent>
                <Separator className="my-4 bg-border/20" />
                <div className="flex justify-between text-sm">
                  <div>
                    <p className="text-secondary-foreground/80">
                      Total Credit
                    </p>
                    <p className="font-semibold text-destructive">
                      {formatCurrency(totalCredit)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-secondary-foreground/80">Total Paid</p>
                    <p className="font-semibold text-success">
                      {formatCurrency(totalPaid)}
                    </p>
                  </div>
                </div>
              </CollapsibleContent>

              <div className="mt-4 flex justify-center">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="link"
                    className="text-secondary-foreground/80 hover:text-secondary-foreground"
                  >
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
            <CardDescription>
              A complete log of all credits and payments for this customer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-center">Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length > 0 ? (
                  transactions.map((tx) => {
                    const isOpen = openTransaction === tx.id;
                    const hasItems = tx.type === 'credit' && tx.items && tx.items.length > 0;
                    return (
                    <React.Fragment key={tx.id}>
                      <TableRow
                        className={cn(
                          tx.status === 'deleted' && 'opacity-50',
                          hasItems && 'cursor-pointer'
                        )}
                        onClick={() => hasItems && toggleTransactionRow(tx.id)}
                      >
                        <TableCell className="p-2 align-middle">
                          {hasItems ? (
                            <ChevronDown
                              className={cn(
                                'h-5 w-5 transition-transform',
                                isOpen && 'rotate-180'
                              )}
                            />
                          ) : (
                            <div className="w-5 h-5" />
                          )}
                        </TableCell>
                        <TableCell
                          className={cn(
                            tx.status === 'deleted' && 'line-through'
                          )}
                        >
                          {format(tx.createdAt.toDate(), 'PP')}
                        </TableCell>
                        <TableCell className="text-center">
                          {tx.status === 'deleted' ? (
                            <Badge variant="destructive">Deleted</Badge>
                          ) : (
                            <Badge
                              variant={
                                tx.type === 'credit' ? 'destructive' : 'success'
                              }
                            >
                              {tx.type}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'max-w-[200px] truncate',
                            tx.status === 'deleted' && 'line-through'
                          )}
                        >
                          {tx.description || (tx.items ? `${tx.items.length} items` : 'Payment')}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-mono',
                            tx.status === 'deleted' && 'line-through'
                          )}
                        >
                          {formatCurrency(tx.amount)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDeleteAlert('deleteTransaction', tx.id);
                            }}
                            disabled={tx.status === 'deleted'}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      {isOpen && hasItems && (
                          <TableRow>
                            <TableCell colSpan={6} className="p-2 bg-muted/50">
                              <div className="p-2 bg-background rounded-md">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="h-8">Item Name</TableHead>
                                      <TableHead className="h-8 text-center w-24">Qty</TableHead>
                                      <TableHead className="h-8 text-right w-32">Unit Price</TableHead>
                                      <TableHead className="h-8 text-right w-32">Amount</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {tx.items!.map((item, index) => (
                                      <TableRow key={index} className="border-none">
                                        <TableCell className="py-1 font-medium">{item.itemName}</TableCell>
                                        <TableCell className="py-1 text-center">{item.quantity}</TableCell>
                                        <TableCell className="py-1 text-right font-mono">{formatCurrency(item.unitPrice)}</TableCell>
                                        <TableCell className="py-1 text-right font-mono">{formatCurrency(item.total)}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                      )}
                    </React.Fragment>
                  )})
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
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
          <Button
            className="fixed bottom-24 right-6 h-16 w-16 rounded-full shadow-2xl"
            size="icon"
            disabled={customer?.status === 'deleted'}
          >
            <Plus className="h-8 w-8" />
            <span className="sr-only">New Transaction</span>
          </Button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl sm:max-w-2xl mx-auto border-none bg-card p-0"
        >
          <SheetHeader className="p-6">
            <SheetTitle>New Transaction</SheetTitle>
            <SheetDescription>
              Add a credit or payment to this customer's account.
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="p-6 pt-0">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleFormSubmit)}
                  className="space-y-6"
                >
                  <Tabs
                    value={formType}
                    onValueChange={(value) => {
                      if (value === 'credit' || value === 'payment') {
                        form.setValue('type', value);
                      }
                    }}
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger
                        value="credit"
                        className="gap-2 data-[state=active]:bg-destructive/20 data-[state=active]:text-destructive-foreground data-[state=active]:shadow-inner"
                      >
                        <Plus className="h-4 w-4" />
                        Credit
                      </TabsTrigger>
                      <TabsTrigger
                        value="payment"
                        className="gap-2 data-[state=active]:bg-success/20 data-[state=active]:text-success-foreground data-[state=active]:shadow-inner"
                      >
                        <Minus className="h-4 w-4" />
                        Payment
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="credit" className="pt-4 space-y-6">
                      <div className="space-y-4 p-4 border rounded-lg">
                        <Label className="text-base font-semibold">
                          Add to Credit
                        </Label>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddItem('item')}
                            className="gap-2"
                          >
                            <Package /> Add Item
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddItem('cash')}
                            className="gap-2"
                          >
                            <DollarSign /> Add Cash
                          </Button>
                        </div>
                        
                        {hasProductItems && (
                          <div className="grid grid-cols-[1fr_90px_110px_auto] items-center gap-x-2 px-1 pb-1 text-sm font-medium text-muted-foreground">
                            <Label className="text-center">Item</Label>
                            <Label className="text-center">Qty</Label>
                            <Label className="text-center">Price</Label>
                          </div>
                        )}

                        <div className="space-y-2">
                          {sortedFields.map(({id, originalIndex}) => {
                            const currentItem = form.watch(
                              `items.${originalIndex}`
                            );
                            const showFields = !!currentItem.itemId;

                            if (currentItem.itemName === 'Cash') {
                              return (
                                <div
                                  key={id}
                                  className="grid grid-cols-[1fr_110px_auto] items-start gap-2"
                                >
                                  <div className="col-span-1 flex h-10 items-center rounded-md border border-input bg-background px-3 py-2 text-sm">
                                    Cash Advance
                                  </div>
                                  <FormField
                                    name={`items.${originalIndex}.total`}
                                    control={form.control}
                                    render={({field: amountField}) => (
                                      <FormItem>
                                        <FormControl>
                                          <Input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            {...amountField}
                                            onChange={(e) => {
                                              const value = e.target.value;
                                              amountField.onChange(
                                                value === ''
                                                  ? ''
                                                  : parseFloat(value) || 0
                                              );
                                            }}
                                            className="no-spinners text-right"
                                          />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                  <div className="flex justify-end">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        handleRemoveItem(originalIndex)
                                      }
                                    >
                                      <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={id}
                                className="grid grid-cols-[1fr_90px_110px_auto] items-start gap-2"
                              >
                                <FormField
                                  name={`items.${originalIndex}.itemName`}
                                  control={form.control}
                                  render={({field: formField}) => (
                                    <FormItem>
                                      <Popover
                                        open={
                                          popoverStates[originalIndex] ?? false
                                        }
                                        onOpenChange={(open) =>
                                          setPopoverStates((prev) => ({
                                            ...prev,
                                            [originalIndex]: open,
                                          }))
                                        }
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
                                              {formField.value ||
                                                'Select an item'}
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
                                            <CommandInput placeholder="Search inventory..." />
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
                                                      update(originalIndex, {
                                                        ...form.getValues(
                                                          `items.${originalIndex}`
                                                        ),
                                                        itemName: item.name,
                                                        unitPrice: item.price,
                                                        itemId: item.id,
                                                        total:
                                                          item.price *
                                                          (form.getValues(
                                                            `items.${originalIndex}.quantity`
                                                          ) || 1),
                                                      });
                                                      setPopoverStates(
                                                        (prev) => ({
                                                          ...prev,
                                                          [originalIndex]: false,
                                                        })
                                                      );
                                                    }}
                                                  >
                                                    <Check
                                                      className={cn(
                                                        'mr-2 h-4 w-4',
                                                        formField.value ===
                                                          item.name
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
                                {showFields ? (
                                  <>
                                    <FormField
                                      name={`items.${originalIndex}.quantity`}
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
                                                onChange={(e) => {
                                                  const qty =
                                                    parseInt(
                                                      e.target.value,
                                                      10
                                                    ) || 0;
                                                  const price = form.getValues(
                                                    `items.${originalIndex}.unitPrice`
                                                  );
                                                  formField.onChange(qty);
                                                  form.setValue(
                                                    `items.${originalIndex}.total`,
                                                    (price || 0) * qty
                                                  );
                                                }}
                                              />
                                              <div className="absolute inset-y-0 right-0 flex items-center">
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-full w-6"
                                                  onClick={() => {
                                                    const val = Math.max(
                                                      1,
                                                      (formField.value || 1) - 1
                                                    );
                                                    formField.onChange(val);
                                                    const price =
                                                      form.getValues(
                                                        `items.${originalIndex}.unitPrice`
                                                      );
                                                    form.setValue(
                                                      `items.${originalIndex}.total`,
                                                      (price || 0) * val
                                                    );
                                                  }}
                                                  disabled={
                                                    formField.value <= 1
                                                  }
                                                >
                                                  <Minus className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-full w-6"
                                                  onClick={() => {
                                                    const val =
                                                      (formField.value || 0) +
                                                      1;
                                                    formField.onChange(val);
                                                    const price =
                                                      form.getValues(
                                                        `items.${originalIndex}.unitPrice`
                                                      );
                                                    form.setValue(
                                                      `items.${originalIndex}.total`,
                                                      (price || 0) * val
                                                    );
                                                  }}
                                                >
                                                  <Plus className="h-4 w-4" />
                                                </Button>
                                              </div>
                                            </div>
                                          </FormControl>
                                        </FormItem>
                                      )}
                                    />
                                    <FormField
                                      name={`items.${originalIndex}.unitPrice`}
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
                                              onChange={(e) => {
                                                const price =
                                                  parseFloat(e.target.value) ||
                                                  0;
                                                const qty = form.getValues(
                                                  `items.${originalIndex}.quantity`
                                                );
                                                formField.onChange(price);
                                                form.setValue(
                                                  `items.${originalIndex}.total`,
                                                  price * (qty || 0)
                                                );
                                              }}
                                            />
                                          </FormControl>
                                        </FormItem>
                                      )}
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        handleRemoveItem(originalIndex)
                                      }
                                    >
                                      <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                  </>
                                ) : (
                                  <div className="col-span-3" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <Separator />
                      <FormField
                        control={form.control}
                        name="amount"
                        render={({field}) => (
                          <FormItem>
                            <FormLabel>Total Credit Amount (₱)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...field}
                                disabled
                                className="font-bold text-lg"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TabsContent>
                    <TabsContent value="payment" className="pt-4 space-y-6">
                      <>
                        <FormField
                          control={form.control}
                          name="amount"
                          render={({field}) => (
                            <FormItem>
                              <FormLabel>Amount (₱)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  {...field}
                                  onChange={(e) => {
                                    field.onChange(
                                      e.target.valueAsNumber || 0
                                    );
                                    if (selectedCredits.size > 0) {
                                      setSelectedCredits(new Set());
                                      form.setValue('description', '');
                                    }
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="description"
                          render={({field}) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="e.g., Payment for invoice #123"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <FormLabel>
                              Pay off specific credits (optional)
                            </FormLabel>
                            {outstandingCreditTransactions.length > 0 && (
                              <Button
                                type="button"
                                variant="link"
                                size="sm"
                                onClick={handleSelectAllCredits}
                                className="h-auto p-0"
                              >
                                {selectedCredits.size === outstandingCreditTransactions.length ? 'Deselect All' : 'Select All'}
                              </Button>
                            )}
                          </div>
                          <Card className="max-h-60 overflow-y-auto">
                            <CardContent className="p-2">
                              {outstandingCreditTransactions.length > 0 ? (
                                outstandingCreditTransactions.map((tx) => (
                                  <div
                                    key={tx.id}
                                    className="flex items-center space-x-3 p-2 rounded-md transition-colors hover:bg-muted has-[:checked]:bg-primary/10"
                                  >
                                    <Checkbox
                                      id={`credit-${tx.id}`}
                                      checked={selectedCredits.has(tx.id)}
                                      onCheckedChange={() =>
                                        handleCreditSelection(tx.id)
                                      }
                                    />
                                    <label
                                      htmlFor={`credit-${tx.id}`}
                                      className="flex justify-between items-center w-full text-sm font-normal cursor-pointer"
                                    >
                                      <div>
                                        <p className="font-medium">
                                          {tx.description || 'Credit'}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {format(
                                            tx.createdAt.toDate(),
                                            'PP'
                                          )}
                                        </p>
                                      </div>
                                      <span className="font-mono">
                                        {formatCurrency(tx.amount)}
                                      </span>
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
                    </TabsContent>
                  </Tabs>

                  <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4">
                    <SheetClose asChild>
                      <Button type="button" variant="secondary">
                        Cancel
                      </Button>
                    </SheetClose>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting && (
                        <Loader2 className="mr-2 animate-spin" />
                      )}
                      {formType === 'payment'
                        ? 'Record Payment'
                        : 'Add Credit'}
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
                ? 'This will permanently delete this customer and all of their associated transactions. This action cannot be undone.'
                : 'This will permanently delete this transaction and restore any associated product stock. This action cannot be undone.'}
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
              Update the name for this customer. This will not affect past
              records.
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
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isUpdatingName}>
                {isUpdatingName && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
