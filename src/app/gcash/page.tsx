
'use client';

import * as React from 'react';
import {useState, useEffect, useMemo} from 'react';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import {
  collection,
  query,
  onSnapshot,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import {isToday} from 'date-fns';
import {db} from '@/lib/firebase';
import {submitGcashTransaction} from '@/app/actions/sale.actions';
import type {SaleTransaction} from '@/lib/schemas';

import {
  Card,
  CardContent,
  CardDescription,
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
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {useToast} from '@/hooks/use-toast';
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  FileWarning,
  Receipt,
  ArrowRight,
  ArrowLeft,
  Phone,
  Wallet,
} from 'lucide-react';
import {Skeleton} from '@/components/ui/skeleton';
import {cn} from '@/lib/utils';
import {format} from 'date-fns';
import {Badge} from '@/components/ui/badge';

const GcashServiceSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than zero.'),
});
type GcashServiceFormData = z.infer<typeof GcashServiceSchema>;

// Set your initial G-Cash balance here.
const INITIAL_GCASH_BALANCE = 9517.16;

const parseTransactionDetails = (tx: SaleTransaction) => {
    let type = 'Unknown';
    let amount = 0;
    let fee = 0;
    let revenue = 0;
    
    const serviceType = tx.serviceType || 'gcash';

    if (serviceType === 'gcash-expense') {
      type = 'Expense';
      amount = Math.abs(tx.total);
      fee = 0;
      revenue = tx.total; // already negative
    } else if (serviceType === 'gcash' && tx.customerName?.includes('G-Cash In')) {
      type = 'Cash In';
      const cashInItem = tx.items.find((i) => i.itemName.includes('Gcash Cash-In'));
      const feeItem = tx.items.find((i) => i.itemName.includes('Gcash Cash-In Fee'));
      amount = cashInItem?.total || 0;
      fee = feeItem?.total || 0;
      revenue = fee;
    } else if (serviceType === 'gcash' && tx.customerName?.includes('G-Cash Out')) {
      type = 'Cash Out';
      const cashOutItem = tx.items.find((i) => i.itemName === 'Gcash Cash-Out');
      const feeItem = tx.items.find((i) => i.itemName === 'Gcash Cash-Out Fee');
      amount = cashOutItem ? Math.abs(cashOutItem.total) : 0;
      fee = feeItem?.total || 0;
      revenue = fee;
    } else if (serviceType === 'gcash-e-load') {
      type = 'E-Load';
      const eloadItem = tx.items.find((i) => i.itemName.includes('E-Load') && !i.itemName.includes('Fee'));
      const feeItem = tx.items.find((i) => i.itemName.includes('E-Load Fee'));
      amount = eloadItem?.total || 0;
      fee = feeItem?.total || 0;
      revenue = fee;
    }
  
    return {type, amount, fee, revenue};
};

export default function GcashPage() {
  const [transactions, setTransactions] = useState<SaleTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allReceipts, setAllReceipts] = useState<any[]>([]);
  const {toast} = useToast();

  const gcashForm = useForm<GcashServiceFormData>({
    resolver: zodResolver(GcashServiceSchema),
    defaultValues: {
      amount: undefined,
    },
  });

  useEffect(() => {
    const q = query(
      collection(db, 'saleTransactions'),
      where('serviceType', 'in', ['gcash', 'gcash-e-load']),
      orderBy('createdAt', 'desc')
    );

    const unsubTransactions = onSnapshot(
      q,
      (snapshot) => {
        const data: SaleTransaction[] = snapshot.docs.map(
          (doc) => ({id: doc.id, ...doc.data()} as SaleTransaction)
        );
        setTransactions(data);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching G-Cash transactions:', error);
        toast({
          variant: 'destructive',
          title: 'Database Error',
          description: 'Could not fetch G-Cash transactions.',
        });
        setIsLoading(false);
      }
    );

    const receiptsQuery = query(
      collection(db, 'receipts'),
      where('paymentSource', '==', 'G-Cash'),
      orderBy('createdAt', 'desc')
    );
  
    const unsubReceipts = onSnapshot(receiptsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        type: 'Expense',
        createdAt: doc.data().createdAt,
        total: doc.data().total,
        merchantName: doc.data().merchantName
      }));
      setAllReceipts(data);
    });

    return () => {
      unsubTransactions();
      unsubReceipts();
    }
  }, [toast]);

  const {
    totalCashIn,
    totalCashOut,
    totalEload,
    totalFees,
    currentBalance,
    totalExpenses,
    unifiedHistory,
  } = useMemo(() => {
    let cashIn = 0;
    let cashOut = 0;
    let eload = 0;
    let fees = 0;
    let expenses = 0;
    let digitalNetFlow = 0;

    const allTransactions = [
        ...transactions,
        ...allReceipts.map(r => ({
            id: r.id,
            serviceType: 'gcash-expense',
            total: -r.total,
            createdAt: r.createdAt,
            items: [{itemName: r.merchantName, quantity: 1, unitPrice: r.total, total: r.total}]
        }))
    ].sort((a,b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());


    allTransactions.forEach((tx) => {
        const details = parseTransactionDetails(tx as SaleTransaction);
        if (details.type === 'Cash In') {
            digitalNetFlow -= details.amount;
        } else if (details.type === 'Cash Out') {
            digitalNetFlow += details.amount;
        } else if (details.type === 'E-Load') {
            digitalNetFlow -= details.amount;
        } else if (details.type === 'Expense') {
            digitalNetFlow -= details.amount;
        }
    
        if (isToday(tx.createdAt.toDate())) {
            if (details.type === 'Cash In') {
              cashIn += details.amount;
              fees += details.fee;
            } else if (details.type === 'Cash Out') {
              cashOut += details.amount;
              fees += details.fee;
            } else if (details.type === 'E-Load') {
              eload += details.amount;
              fees += details.fee;
            } else if (details.type === 'Expense') {
              expenses += details.amount;
            }
        }
    });

    const currentBalance = INITIAL_GCASH_BALANCE + digitalNetFlow;
    
    const unifiedHistory = allTransactions.map(tx => {
        const details = parseTransactionDetails(tx as SaleTransaction);
        return {
            id: tx.id,
            date: tx.createdAt.toDate(),
            ...details
        }
    });

    return {
      totalCashIn: cashIn,
      totalCashOut: cashOut,
      totalEload: eload,
      totalFees: fees,
      currentBalance,
      totalExpenses: expenses,
      unifiedHistory,
    };
  }, [transactions, allReceipts]);


  const handleGcashSubmit = async (
    type: 'cash-in' | 'cash-out' | 'e-load',
    data: GcashServiceFormData
  ) => {
    setIsSubmitting(true);
    const response = await submitGcashTransaction(type, data.amount);

    if (response.success) {
      toast({
        variant: 'success',
        title: 'Transaction Recorded',
      });
      gcashForm.reset();
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: response.message,
      });
    }
    setIsSubmitting(false);
  };

  const formatCurrency = (value: number) =>
    `₱${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const renderForm = (type: 'cash-in' | 'cash-out' | 'e-load') => {
    const titles = {
      'cash-in': 'Gcash Cash-In',
      'cash-out': 'Gcash Cash-Out',
      'e-load': 'E-Load',
    };
    const descriptions = {
      'cash-in': 'Enter amount customer is cashing in. Fee will be added.',
      'cash-out': 'Enter amount customer is cashing out. Fee will be earned.',
      'e-load': 'Enter load amount. A ₱2.00 fee will be added.',
    };

    return (
      <Card className="col-span-1 md:col-span-2">
        <CardHeader>
          <CardTitle>{titles[type]}</CardTitle>
          <CardDescription>{descriptions[type]}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...gcashForm}>
            <form
              onSubmit={gcashForm.handleSubmit((data) =>
                handleGcashSubmit(type, data)
              )}
              className="space-y-4"
            >
              <FormField
                control={gcashForm.control}
                name="amount"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Amount (₱)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="1"
                        placeholder="e.g. 1000"
                        {...field}
                        className="no-spinners text-lg"
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting && <Loader2 className="mr-2 animate-spin" />}
                Record Transaction
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6 opacity-0 animate-page-enter">
      <header>
        <h1 className="text-2xl font-bold">G-Cash Services</h1>
      </header>
      <Card className="bg-primary text-primary-foreground">
        <CardHeader className="items-center text-center">
          <CardTitle className="flex items-center gap-2">
            <Wallet /> G-Cash Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-5xl font-bold text-center tracking-tighter">
            {formatCurrency(currentBalance)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Today's G-Cash Summary</CardTitle>
          <CardDescription>
            Overview of transactions for {format(new Date(), 'MMMM d, yyyy')}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
            <Card>
              <CardHeader className="p-4">
                <CardDescription>Cash In</CardDescription>
                <CardTitle className="text-destructive">
                  {formatCurrency(totalCashIn)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="p-4">
                <CardDescription>Cash Out</CardDescription>
                <CardTitle className="text-success">
                  {formatCurrency(totalCashOut)}
                </CardTitle>
              </CardHeader>
            </Card>
             <Card>
              <CardHeader className="p-4">
                <CardDescription>E-Load</CardDescription>
                <CardTitle className="text-destructive">
                  {formatCurrency(totalEload)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="p-4">
                <CardDescription>Fees Earned</CardDescription>
                <CardTitle className="text-success">
                  {formatCurrency(totalFees)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="cash-in" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="cash-in">Cash In</TabsTrigger>
          <TabsTrigger value="cash-out">Cash Out</TabsTrigger>
          <TabsTrigger value="e-load">E-Load</TabsTrigger>
        </TabsList>
        <TabsContent value="cash-in">{renderForm('cash-in')}</TabsContent>
        <TabsContent value="cash-out">{renderForm('cash-out')}</TabsContent>
        <TabsContent value="e-load">{renderForm('e-load')}</TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>G-Cash Transaction History</CardTitle>
          <CardDescription>
            A log of all your recorded G-Cash services and expenses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({length: 5}).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-5 w-3/4" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-1/2" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-5 w-1/4 ml-auto" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-5 w-1/4 ml-auto" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-5 w-1/4 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : unifiedHistory.length > 0 ? (
                  unifiedHistory.map((tx) => {
                    const isOutflow = tx.type === 'Cash In' || tx.type === 'E-Load' || tx.type === 'Expense';

                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(tx.date, 'PPp')}
                        </TableCell>
                        <TableCell>
                          <Badge
                           variant={
                            tx.type === 'Cash Out' ? 'success' : 'destructive'
                          }
                          >
                            {tx.type}
                          </Badge>
                        </TableCell>
                        <TableCell className={cn('text-right font-mono', tx.type === 'Cash Out' ? 'text-success' : 'text-destructive')}>
                          {formatCurrency(tx.amount)}
                        </TableCell>
                        <TableCell
                          className={cn('text-right font-mono text-success')}
                        >
                          {formatCurrency(tx.fee)}
                        </TableCell>
                        <TableCell
                          className={cn('text-right font-mono font-semibold', tx.revenue >= 0 ? 'text-primary' : 'text-destructive')}
                        >
                          {formatCurrency(tx.revenue)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No G-Cash transactions found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
