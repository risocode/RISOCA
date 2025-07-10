
'use client';

import {useState, useEffect, useMemo} from 'react';
import Link from 'next/link';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  type Timestamp,
} from 'firebase/firestore';
import {db} from '@/lib/firebase';
import {addCustomer} from '@/app/actions';
import {type Customer, type LedgerTransaction} from '@/lib/schemas';

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
import {Textarea} from '@/components/ui/textarea';
import {useToast} from '@/hooks/use-toast';
import {
  UserPlus,
  Loader2,
  ChevronRight,
  Info,
  Search,
  Users,
  CheckCircle,
} from 'lucide-react';
import {Skeleton} from '@/components/ui/skeleton';
import {cn} from '@/lib/utils';

const AddCustomerFormSchema = z.object({
  name: z.string().min(1, 'Customer name is required.'),
  amount: z.coerce
    .number()
    .min(0, 'Initial credit must be a positive number.'),
  description: z.string().optional(),
});
type AddCustomerFormData = z.infer<typeof AddCustomerFormSchema>;

type CustomerWithDetails = Customer & {balance: number; paid: number};

export default function LedgerPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const {toast} = useToast();

  const form = useForm<AddCustomerFormData>({
    resolver: zodResolver(AddCustomerFormSchema),
    defaultValues: {
      name: '',
      amount: 0,
      description: '',
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
          description: 'Could not fetch customers.',
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
          description: 'Could not fetch transactions.',
        });
      }
    );

    return () => {
      unsubscribeCustomers();
      unsubscribeTransactions();
    };
  }, [toast]);

  const handleFormSubmit = async (data: AddCustomerFormData) => {
    setIsSubmitting(true);
    const response = await addCustomer(data);

    if (response.success) {
      toast({
        variant: 'success',
        title: 'Customer Added',
      });
      setIsDialogOpen(false);
      form.reset();
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: response.message || 'An unknown error occurred.',
      });
    }
    setIsSubmitting(false);
  };

  const {processedCustomers, totalBalance, topDebtors} = useMemo(() => {
    const customerBalances: Record<string, number> = {};
    const customerPayments: Record<string, number> = {};

    transactions
      .filter((tx) => tx.status !== 'deleted')
      .forEach((tx) => {
        const currentBalance = customerBalances[tx.customerId] || 0;
        if (tx.type === 'credit') {
          customerBalances[tx.customerId] = currentBalance + tx.amount;
        } else {
          customerBalances[tx.customerId] = currentBalance - tx.amount;
          customerPayments[tx.customerId] =
            (customerPayments[tx.customerId] || 0) + tx.amount;
        }
      });

    const allCustomersWithDetails: CustomerWithDetails[] = customers
      .filter((c) => c.status !== 'deleted')
      .map((c) => ({
        ...c,
        balance: customerBalances[c.id] || 0,
        paid: customerPayments[c.id] || 0,
      }));

    const topDebtors = allCustomersWithDetails
      .filter((c) => c.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 3);

    let filteredCustomers = allCustomersWithDetails;
    if (searchTerm) {
      filteredCustomers = filteredCustomers.filter((c) =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    const totalBalance = Object.values(customerBalances).reduce(
      (sum, bal) => sum + bal,
      0
    );

    return {
      processedCustomers: filteredCustomers,
      totalBalance,
      topDebtors,
    };
  }, [customers, transactions, searchTerm]);

  const formatCurrency = (value: number) =>
    `₱${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Credit Ledger</h1>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Ledger Overview</CardTitle>
          <CardDescription>
            A summary of your outstanding credit across all customers.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col items-center justify-center p-6 rounded-lg bg-secondary text-secondary-foreground text-center">
            <h3 className="text-lg font-normal text-secondary-foreground/80">
              Total Outstanding Balance
            </h3>
            <p className="text-5xl font-bold tracking-tighter mt-2 text-destructive">
              {formatCurrency(totalBalance)}
            </p>
          </div>
          <div className="space-y-3">
            <h3 className="font-semibold text-center md:text-left text-lg">
              Top 3 Debtors
            </h3>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : topDebtors.length > 0 ? (
              <ul className="space-y-2">
                {topDebtors.map((customer) => (
                  <li key={customer.id}>
                    <Link
                      href={`/store/ledger/${customer.id}`}
                      className="flex justify-between items-center p-3 rounded-md hover:bg-muted transition-colors border"
                    >
                      <span className="font-medium">{customer.name}</span>
                      <span className="font-mono text-destructive font-semibold">
                        {formatCurrency(customer.balance)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-4 text-muted-foreground border-dashed border rounded-lg h-full">
                <Users className="w-8 h-8 mb-2" />
                <p>No customers with outstanding balances.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Customer List</CardTitle>
            <CardDescription>
              Select a customer to view their transaction history.
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search customers..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="px-4 py-2 border-b grid grid-cols-[2fr_1fr_1fr_auto] items-center gap-4">
            <h4 className="text-sm font-medium text-muted-foreground">Name</h4>
            <h4 className="text-sm font-medium text-muted-foreground text-center">
              Balance
            </h4>
            <h4 className="text-sm font-medium text-muted-foreground text-center">
              Paid
            </h4>
            <span className="sr-only">Action</span>
          </div>
          <div>
            {isLoading ? (
              Array.from({length: 5}).map((_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[2fr_1fr_1fr_auto] items-center p-4 gap-4 border-b"
                >
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-6 w-20 justify-self-center" />
                  <Skeleton className="h-6 w-20 justify-self-center" />
                  <Skeleton className="h-5 w-5 justify-self-end" />
                </div>
              ))
            ) : processedCustomers.length > 0 ? (
              processedCustomers.map((customer) => {
                const isPaid = customer.balance <= 0;
                return (
                  <Link
                    key={customer.id}
                    href={`/store/ledger/${customer.id}`}
                    className="grid grid-cols-[2fr_1fr_1fr_auto] items-center p-4 border-b last:border-b-0 hover:bg-muted/50 transition-colors gap-4"
                  >
                    <span
                      className={cn(
                        'font-medium truncate flex items-center gap-2',
                        isPaid && 'text-success'
                      )}
                    >
                      {isPaid && <CheckCircle className="h-4 w-4" />}
                      {customer.name}
                    </span>
                    <span
                      className={cn(
                        'font-mono text-center',
                        isPaid ? 'text-success' : 'text-destructive'
                      )}
                    >
                      {formatCurrency(customer.balance)}
                    </span>
                    <span className="font-mono text-center text-muted-foreground">
                      {formatCurrency(customer.paid)}
                    </span>
                    <ChevronRight className="w-5 h-5 text-muted-foreground justify-self-end" />
                  </Link>
                );
              })
            ) : (
              <div className="text-center p-10 text-muted-foreground flex flex-col items-center">
                <Info className="w-8 h-8 mb-2" />
                <p>
                  {searchTerm
                    ? `No customers found for "${searchTerm}"`
                    : 'No customers yet. Add one to get started.'}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
              Enter the customer's details and their initial credit amount.
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
              <FormField
                control={form.control}
                name="amount"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Initial Credit Amount (₱)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
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
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Initial balance"
                        {...field}
                      />
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
    </div>
  );
}
