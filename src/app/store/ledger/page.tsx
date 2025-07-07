'use client';

import {useState, useEffect, useMemo} from 'react';
import Link from 'next/link';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  type Timestamp,
} from 'firebase/firestore';
import {db} from '@/lib/firebase';
import {addCustomer} from '@/app/actions';
import {
  CustomerSchema,
  type Customer,
  type CustomerInput,
  type LedgerTransaction,
} from '@/lib/schemas';

import {Button} from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {Input} from '@/components/ui/input';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {useToast} from '@/hooks/use-toast';
import {
  UserPlus,
  Loader2,
  ChevronRight,
  Info,
  Users,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import {Skeleton} from '@/components/ui/skeleton';

type CustomerWithBalance = Customer & {balance: number};

export default function LedgerPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const {toast} = useToast();

  const form = useForm<CustomerInput>({
    resolver: zodResolver(CustomerSchema),
    defaultValues: {
      name: '',
    },
  });

  useEffect(() => {
    setIsLoading(true);
    const customersQuery = query(
      collection(db, 'customers'),
      orderBy('name', 'asc')
    );
    const transactionsQuery = query(
      collection(db, 'ledger'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeCustomers = onSnapshot(
      customersQuery,
      (snapshot) => {
        const customersData = snapshot.docs.map(
          (doc) => ({id: doc.id, ...doc.data()}) as Customer
        );
        setCustomers(customersData);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching customers:', error);
        toast({
          variant: 'destructive',
          title: 'Database Error',
          description: 'Could not fetch customers data.',
        });
        setIsLoading(false);
      }
    );

    const unsubscribeTransactions = onSnapshot(
      transactionsQuery,
      (snapshot) => {
        const transactionsData = snapshot.docs.map(
          (doc) => ({id: doc.id, ...doc.data()}) as LedgerTransaction
        );
        setTransactions(transactionsData);
      },
      (error) => {
        console.error('Error fetching transactions:', error);
        toast({
          variant: 'destructive',
          title: 'Database Error',
          description: 'Could not fetch transactions data.',
        });
      }
    );

    return () => {
      unsubscribeCustomers();
      unsubscribeTransactions();
    };
  }, [toast]);

  const handleFormSubmit = async (data: CustomerInput) => {
    setIsSubmitting(true);
    const response = await addCustomer(data);

    if (response.success) {
      toast({
        title: 'Customer Added',
        description: 'The new customer has been added to the ledger.',
      });
      setIsDialogOpen(false);
      form.reset();
    } else {
      toast({
        variant: 'destructive',
        title: 'Action Failed',
        description: response.message || 'An unknown error occurred.',
      });
    }
    setIsSubmitting(false);
  };

  const {
    customersWithBalance,
    totalBalance,
    totalCredit,
    totalPayment,
  } = useMemo(() => {
    const customerBalances: Record<string, number> = {};

    transactions.forEach((tx) => {
      if (tx.type === 'credit') {
        customerBalances[tx.customerId] =
          (customerBalances[tx.customerId] || 0) + tx.amount;
      } else {
        customerBalances[tx.customerId] =
          (customerBalances[tx.customerId] || 0) - tx.amount;
      }
    });

    const customersWithBalance = customers.map((c) => ({
      ...c,
      balance: customerBalances[c.id] || 0,
    }));

    const totalCredit = transactions
      .filter((tx) => tx.type === 'credit')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const totalPayment = transactions
      .filter((tx) => tx.type === 'payment')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const totalBalance = totalCredit - totalPayment;

    return {customersWithBalance, totalBalance, totalCredit, totalPayment};
  }, [customers, transactions]);

  const filteredCustomers = useMemo(() => {
    if (filter === 'paid') {
      return customersWithBalance.filter((c) => c.balance <= 0);
    }
    if (filter === 'unpaid') {
      return customersWithBalance.filter((c) => c.balance > 0);
    }
    return customersWithBalance;
  }, [customersWithBalance, filter]);

  const formatCurrency = (value: number) =>
    `₱${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <>
      <div className="flex flex-1 flex-col p-4 md:p-6 space-y-4">
        <header>
          <h1 className="text-2xl font-bold">Credit Ledger</h1>
        </header>

        <Card className="shadow-lg text-primary-foreground bg-primary">
          <CardHeader>
            <CardTitle className="text-lg font-normal">
              Total Outstanding Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-5xl font-bold tracking-tighter">
              {formatCurrency(totalBalance)}
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Customers</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customers.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                Total Credit
              </CardTitle>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(totalCredit)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
              <TrendingDown className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(totalPayment)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Customer List</CardTitle>
            <Tabs
              defaultValue="all"
              className="w-full sm:w-auto"
              onValueChange={setFilter}
            >
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="unpaid">With Balance</TabsTrigger>
                <TabsTrigger value="paid">Fully Paid</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-2">
              {isLoading ? (
                Array.from({length: 5}).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center p-4 space-x-4 border-b"
                  >
                    <Skeleton className="h-6 flex-1" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))
              ) : filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer) => (
                  <Link
                    key={customer.id}
                    href={`/store/ledger/${customer.id}`}
                    className="flex items-center p-4 border-b last:border-b-0 hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium flex-1">{customer.name}</span>
                    <span
                      className={`font-mono text-right mr-2 ${
                        customer.balance > 0
                          ? 'text-destructive'
                          : 'text-green-600'
                      }`}
                    >
                      {formatCurrency(customer.balance)}
                    </span>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </Link>
                ))
              ) : (
                <div className="text-center p-10 text-muted-foreground flex flex-col items-center">
                  <Info className="w-8 h-8 mb-2" />
                  <p>No customers found for this filter.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button
            className="fixed bottom-24 right-6 h-16 w-16 rounded-full shadow-2xl"
            size="icon"
          >
            <UserPlus className="h-8 w-8" />
            <span className="sr-only">Add Customer</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>
              Enter the name of the new customer to add them to the ledger.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleFormSubmit)}
              className="space-y-4 py-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Customer Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 animate-spin" />}
                  Add Customer
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
