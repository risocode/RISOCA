'use client';

import {useState, useEffect, useMemo} from 'react';
import Link from 'next/link';
import {useParams, useRouter} from 'next/navigation';
import {useForm, useWatch} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {
  collection,
  query,
  onSnapshot,
  doc,
  where,
} from 'firebase/firestore';
import {db} from '@/lib/firebase';
import {
  addLedgerTransaction,
  deleteLedgerTransaction,
  deleteCustomer,
} from '@/app/actions';
import {
  LedgerTransactionSchema,
  type Customer,
  type LedgerTransaction,
  type LedgerTransactionInput,
} from '@/lib/schemas';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import {Button} from '@/components/ui/button';
import {useToast} from '@/hooks/use-toast';
import {
  ArrowLeft,
  Trash2,
  Loader2,
  Plus,
  Minus,
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
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {Badge} from '@/components/ui/badge';
import {Checkbox} from '@/components/ui/checkbox';
import {format} from 'date-fns';
import {cn} from '@/lib/utils';

const TransactionFormSchema = LedgerTransactionSchema.omit({customerId: true, paidCreditIds: true});
type TransactionFormData = Omit<LedgerTransactionInput, 'customerId' | 'paidCreditIds'>;

export default function CustomerLedgerPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;
  const {toast} = useToast();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [alertAction, setAlertAction] = useState<'deleteTransaction' | 'deleteCustomer' | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedCredits, setSelectedCredits] = useState<Set<string>>(new Set());

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(TransactionFormSchema),
    defaultValues: {
      type: 'credit',
      amount: 0,
      description: '',
    },
  });

  const formType = useWatch({ control: form.control, name: 'type' });

  useEffect(() => {
    if (!customerId) return;
    setIsLoading(true);

    const unsubCustomer = onSnapshot(
      doc(db, 'customers', customerId),
      (doc) => {
        if (doc.exists()) {
          setCustomer({id: doc.id, ...doc.data()} as Customer);
        } else {
          toast({
            variant: 'destructive',
            title: 'Customer Not Found',
            description: 'This customer may have been deleted. Redirecting...',
            duration: 1000,
          });
          router.push('/store/ledger');
        }
        setIsLoading(false);
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

    return () => {
      unsubCustomer();
      unsubTransactions();
    };
  }, [customerId, router, toast]);

  const balance = useMemo(() => {
    return transactions.reduce((acc, tx) => {
      return acc + (tx.type === 'credit' ? tx.amount : -tx.amount);
    }, 0);
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
      .filter((tx) => tx.type === 'credit' && !paidCreditIds.has(tx.id))
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
    
    const payload: LedgerTransactionInput = {
      customerId,
      ...data,
    };

    if (data.type === 'payment' && selectedCredits.size > 0) {
        payload.paidCreditIds = Array.from(selectedCredits);
    }

    const response = await addLedgerTransaction(payload);

    if (response.success) {
      toast({
        title: 'Transaction Added',
        description: 'The transaction has been successfully recorded.',
      });
      form.reset({
        type: data.type,
        amount: 0,
        description: '',
      });
      setSelectedCredits(new Set());
    } else {
      toast({
        variant: 'destructive',
        title: 'Action Failed',
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
      toast({
        variant: 'destructive',
        title: alertAction === 'deleteCustomer' ? 'Customer Deleted' : 'Transaction Deleted',
        description: 'The item has been successfully deleted.'
      });
      if(alertAction === 'deleteCustomer') router.push('/store/ledger');
    } else {
      toast({variant: 'destructive', title: 'Action Failed', description: response?.message || 'An error occurred.'});
    }

    setIsDeleting(false);
    setIsAlertOpen(false);
    setAlertAction(null);
    setDeletingId(null);
  };
  
  const formatCurrency = (value: number) =>
    `₱${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;


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
    <div className="flex flex-1 flex-col p-4 md:p-6 space-y-6">
       <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
           <Button asChild variant="outline" size="icon" className="flex-shrink-0">
            <Link href="/store/ledger">
              <ArrowLeft />
              <span className="sr-only">Back to Ledger</span>
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold truncate">{customer?.name}</h1>
            <p className="text-muted-foreground">
              Balance: <span className={`font-bold ${balance > 0 ? 'text-destructive' : 'text-success'}`}>{formatCurrency(balance)}</span>
            </p>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={() => openDeleteAlert('deleteCustomer')}>
            <Trash2 className="mr-2 h-4 w-4"/> Delete
        </Button>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
            <Card>
                <CardHeader>
                    <CardTitle>New Transaction</CardTitle>
                </CardHeader>
                <CardContent>
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
                            
                             <FormField control={form.control} name="amount" render={({field}) => (
                                <FormItem><FormLabel>Amount (₱)</FormLabel><FormControl>
                                    <Input type="number" step="0.01" {...field} onChange={(e) => {
                                        field.onChange(e);
                                        setSelectedCredits(new Set());
                                    }}/>
                                </FormControl><FormMessage/></FormItem>
                            )}/>
                             <FormField control={form.control} name="description" render={({field}) => (
                                <FormItem><FormLabel>Description</FormLabel><FormControl>
                                    <Textarea placeholder="e.g., Groceries, Payment for invoice #123" {...field}/>
                                </FormControl><FormMessage/></FormItem>
                            )}/>
                            
                            {formType === 'payment' && (
                                <div className="space-y-2">
                                    <FormLabel>Pay off specific credits (optional)</FormLabel>
                                    <Card className="max-h-60 overflow-y-auto">
                                        <CardContent className="p-2">
                                        {outstandingCreditTransactions.length > 0 ? (
                                            outstandingCreditTransactions.map(tx => (
                                                <div
                                                  key={tx.id}
                                                  className="flex items-center space-x-3 p-2 rounded-md transition-colors hover:bg-muted has-[:checked]:bg-destructive/10"
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
                            )}

                            <Button type="submit" disabled={isSubmitting} className="w-full">
                                {isSubmitting && <Loader2 className="mr-2 animate-spin" />}
                                {formType === 'payment' ? 'Pay' : 'Add Credit'}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-2">
            <Card>
                <CardHeader>
                    <CardTitle>Transaction History</CardTitle>
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
                                    <TableRow key={tx.id}>
                                        <TableCell>{format(tx.createdAt.toDate(), 'PP')}</TableCell>
                                        <TableCell className="text-center"><Badge variant={tx.type === 'credit' ? 'destructive' : 'success'}>{tx.type}</Badge></TableCell>
                                        <TableCell className="max-w-[200px] truncate">{tx.description}</TableCell>
                                        <TableCell className="text-right font-mono">{formatCurrency(tx.amount)}</TableCell>
                                        <TableCell className="text-center">
                                            <Button variant="ghost" size="icon" onClick={() => openDeleteAlert('deleteTransaction', tx.id)}>
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
      </div>
    </div>
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
                : "This will permanently delete this transaction. This action cannot be undone."
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
    </>
  );
}
