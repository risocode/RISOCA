
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
} from 'firebase/firestore';
import {startOfToday, isToday} from 'date-fns';
import {db} from '@/lib/firebase';
import {submitGcashTransaction} from '@/app/actions';
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

export default function GcashPage() {
  const [transactions, setTransactions] = useState<SaleTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {toast} = useToast();

  const gcashForm = useForm<GcashServiceFormData>({
    resolver: zodResolver(GcashServiceSchema),
    defaultValues: {amount: 0},
  });

  useEffect(() => {
    const q = query(
      collection(db, 'saleTransactions'),
      where('serviceType', '==', 'gcash'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
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

    return () => unsubscribe();
  }, [toast]);

  const {
    todaysTransactions,
    totalCashIn,
    totalCashOut,
    totalFees,
    netFlow,
    currentBalance,
  } = useMemo(() => {
    let cashIn = 0;
    let cashOut = 0;
    let fees = 0;

    transactions.forEach((tx) => {
      const {type, amount, fee} = parseTransactionDetails(tx);
      if (isToday(tx.createdAt.toDate())) {
        if (type === 'Cash In') {
          cashIn += amount;
          fees += fee;
        } else if (type === 'Cash Out') {
          cashOut += amount;
          fees += fee;
        } else if (type === 'E-Load') {
          fees += fee;
        }
      }
    });

    const net = -cashIn + cashOut; // Digital money flow
    const currentBalance = INITIAL_GCASH_BALANCE + net;

    return {
      todaysTransactions: transactions.filter((tx) =>
        isToday(tx.createdAt.toDate())
      ),
      totalCashIn: cashIn,
      totalCashOut: cashOut,
      totalFees: fees,
      netFlow: net,
      currentBalance,
    };
  }, [transactions]);

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
      'e-load': 'Enter load amount. A ₱3.00 fee will be added.',
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

  const parseTransactionDetails = (tx: SaleTransaction) => {
    let type = 'Unknown';
    let amount = 0;
    let fee = 0;
    let total = tx.total;

    if (tx.customerName?.includes('G-Cash In')) {
      type = 'Cash In';
      const cashInItem = tx.items.find((i) =>
        i.itemName.includes('Gcash Cash-In') && !i.itemName.includes('Fee')
      );
      const feeItem = tx.items.find((i) =>
        i.itemName.includes('Gcash Cash-In Fee')
      );
      amount = cashInItem?.total || 0;
      fee = feeItem?.total || 0;
      total = amount + fee;
    } else if (tx.customerName?.includes('G-Cash Out')) {
      type = 'Cash Out';
      const cashOutItem = tx.items.find(
        (i) => i.itemName === 'Gcash Cash-Out'
      );
      amount = cashOutItem ? Math.abs(cashOutItem.total) : 0;
      fee =
        tx.items.find((i) => i.itemName === 'Gcash Cash-Out Fee')?.total || 0;
      total = fee;
    } else if (tx.customerName?.includes('E-Load')) {
      type = 'E-Load';
      const eloadItem = tx.items.find((i) => i.itemName.includes('E-Load') && !i.itemName.includes('Fee'));
      const feeItem = tx.items.find((i) => i.itemName.includes('E-Load Fee'));
      amount = eloadItem?.total || 0;
      fee = feeItem?.total || 0;
      total = amount + fee;
    }

    return {type, amount, fee, total};
  };

  return (
    <div className="p-4 md:p-6 space-y-6 opacity-0 animate-page-enter">
      <header>
        <h1 className="text-2xl font-bold">G-Cash Services</h1>
      </header>
      <Card>
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
          <Card className="text-center p-6 bg-secondary text-secondary-foreground">
            <CardDescription className="text-lg">
              Today's Net Flow
            </CardDescription>
            <CardTitle
              className={cn(
                'text-5xl font-bold tracking-tighter',
                netFlow >= 0 ? 'text-success' : 'text-destructive'
              )}
            >
              {formatCurrency(netFlow)}
            </CardTitle>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <Card>
              <CardHeader>
                <CardDescription>Total Cash In</CardDescription>
                <CardTitle className="text-primary">
                  {formatCurrency(totalCashIn)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Total Cash Out</CardDescription>
                <CardTitle className="text-destructive">
                  {formatCurrency(totalCashOut)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Total Fees Earned</CardDescription>
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
            A log of all your recorded G-Cash services.
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
                  <TableHead className="text-right">Total</TableHead>
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
                ) : transactions.length > 0 ? (
                  transactions.map((tx) => {
                    const {type, amount, fee, total} =
                      parseTransactionDetails(tx);
                    const isDebit = type === 'Cash Out';

                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(tx.createdAt.toDate(), 'PPp')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isDebit ? 'destructive' : 'success'}>
                            {type}
                          </Badge>
                        </TableCell>
                        <TableCell className={cn('text-right font-mono')}>
                          {formatCurrency(amount)}
                        </TableCell>
                        <TableCell
                          className={cn('text-right font-mono text-success')}
                        >
                          {formatCurrency(fee)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-mono font-semibold',
                            type === 'Cash In' ? 'text-primary' : (isDebit ? 'text-destructive' : 'text-primary')
                          )}
                        >
                          {formatCurrency(total)}
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
