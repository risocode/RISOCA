'use client';

import Link from 'next/link';
import {useState, useEffect, useMemo} from 'react';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
} from 'firebase/firestore';
import {db} from '@/lib/firebase';
import type {Customer, LedgerTransaction, InventoryItem} from '@/lib/schemas';

import {
  Wallet,
  BookUser,
  Boxes,
  Users,
  ReceiptText
} from 'lucide-react';

import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Skeleton} from '@/components/ui/skeleton';

const StatCard = ({
  title,
  value,
  icon: Icon,
  isLoading,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  isLoading?: boolean;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="w-4 h-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <Skeleton className="h-8 w-3/4" />
      ) : (
        <div className="text-2xl font-bold">{value}</div>
      )}
    </CardContent>
  </Card>
);


export default function HomePage() {
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    
    const unsubscribers = [
      onSnapshot(query(collection(db, 'ledger'), orderBy('createdAt', 'desc')), (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as LedgerTransaction));
      }),
      onSnapshot(query(collection(db, 'customers')), (snapshot) => {
        setCustomers(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Customer));
      }),
      onSnapshot(query(collection(db, 'inventory')), (snapshot) => {
        setInventory(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as InventoryItem));
      }),
      onSnapshot(query(collection(db, 'receipts')), (snapshot) => {
        setReceipts(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()})));
      }),
    ];

    Promise.all(unsubscribers).then(() => setIsLoading(false)).catch(err => {
      console.error(err);
      setIsLoading(false);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, []);

  const totalBalance = useMemo(() => {
    return transactions.reduce((acc, tx) => {
      return acc + (tx.type === 'credit' ? tx.amount : -tx.amount);
    }, 0);
  }, [transactions]);
  
  const totalExpenses = useMemo(() => {
    return receipts.reduce((acc, receipt) => acc + receipt.total, 0);
  }, [receipts]);

  const formatCurrency = (value: number) =>
    `₱${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      </header>
      
      <main className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Credit Balance" value={formatCurrency(totalBalance)} icon={Wallet} isLoading={isLoading}/>
        <StatCard title="Total Customers" value={customers.length} icon={Users} isLoading={isLoading}/>
        <StatCard title="Inventory Items" value={inventory.length} icon={Boxes} isLoading={isLoading}/>
        <StatCard title="Total Expenses" value={formatCurrency(totalExpenses)} icon={ReceiptText} isLoading={isLoading}/>
      </main>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
            <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
                <Button asChild size="lg"><Link href="/store">New Sale</Link></Button>
                <Button asChild size="lg" variant="outline"><Link href="/store/receipts">Add Expense</Link></Button>
                <Button asChild size="lg" variant="outline"><Link href="/store/inventory">Manage Inventory</Link></Button>
                <Button asChild size="lg" variant="outline"><Link href="/store/ledger">Credit Ledger</Link></Button>
            </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-full"/>
                <Skeleton className="h-6 w-full"/>
                <Skeleton className="h-6 w-full"/>
              </div>
            ) : transactions.length > 0 ? (
               <ul className="space-y-2">
                {transactions.slice(0, 5).map(tx => (
                  <li key={tx.id} className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {customers.find(c => c.id === tx.customerId)?.name || 'Unknown Customer'}
                    </span>
                    {' '}
                    made a <span className={tx.type === 'credit' ? 'text-destructive' : 'text-green-600'}>{tx.type}</span> of {formatCurrency(tx.amount)}.
                  </li>
                ))}
               </ul>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No recent transactions.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
