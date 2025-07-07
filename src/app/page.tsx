'use client';

import Link from 'next/link';
import Image from 'next/image';
import {useState, useEffect, useMemo} from 'react';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
} from 'firebase/firestore';
import {db} from '@/lib/firebase';
import type {Customer, LedgerTransaction} from '@/lib/schemas';

import {
  Wallet,
  BookUser,
  CreditCard,
  ShoppingBag,
  SquareTerminal,
  ReceiptText,
  ShoppingCart,
  BarChart,
  User,
} from 'lucide-react';

import {Card, CardContent} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Skeleton} from '@/components/ui/skeleton';

const NavIcon = ({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
}) => (
  <Link
    href={href}
    className="flex flex-col items-center justify-center space-y-2 p-2 text-center rounded-lg hover:bg-muted transition-colors"
  >
    <div className="w-12 h-12 flex items-center justify-center bg-primary/10 rounded-full">
      <Icon className="w-6 h-6 text-primary" />
    </div>
    <span className="text-xs font-medium text-foreground/80">{label}</span>
  </Link>
);

export default function HomePage() {
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const transactionsQuery = query(
      collection(db, 'ledger'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeTransactions = onSnapshot(
      transactionsQuery,
      (snapshot) => {
        const transactionsData = snapshot.docs.map(
          (doc) => ({id: doc.id, ...doc.data()}) as LedgerTransaction
        );
        setTransactions(transactionsData);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching transactions:', error);
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribeTransactions();
    };
  }, []);

  const totalBalance = useMemo(() => {
    return transactions.reduce((acc, tx) => {
      return acc + (tx.type === 'credit' ? tx.amount : -tx.amount);
    }, 0);
  }, [transactions]);

  const formatCurrency = (value: number) =>
    `₱${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const navItems = [
    {href: '/store/pos', icon: Wallet, label: 'Cash'},
    {href: '/store/ledger', icon: BookUser, label: 'Credit'},
    {href: '/store/pos', icon: CreditCard, label: 'Payment'},
    {href: '/store/receipts', icon: ShoppingBag, label: 'Expenses'},
    {href: '/store', icon: SquareTerminal, label: 'POS'},
    {href: '/store/receipts', icon: ReceiptText, label: 'Receipts'},
    {href: '/store/inventory', icon: ShoppingCart, label: 'Purchases'},
    {href: '/store/history', icon: BarChart, label: 'Reports'},
  ];

  return (
    <div className="p-4 space-y-6">
      <header className="flex justify-between items-center">
        <Image
          src="/logo.png"
          alt="RISOCA Logo"
          width={90}
          height={28}
          className="w-auto h-7"
          priority
        />
        <Button variant="outline">
          <User className="mr-2 h-4 w-4" /> Account
        </Button>
      </header>

      <Card className="bg-primary text-primary-foreground shadow-lg">
        <CardContent className="p-4">
          <p className="text-sm opacity-80">Your Balance</p>
          {isLoading ? (
            <Skeleton className="h-10 w-40 mt-1 bg-white/30" />
          ) : (
            <p className="text-4xl font-bold tracking-tighter">
              {formatCurrency(totalBalance)}
            </p>
          )}
          <p className="text-xs opacity-60 mt-1">Powered by Netbank</p>
        </CardContent>
      </Card>

      <main>
        <div className="grid grid-cols-4 gap-2">
          {navItems.map((item) => (
            <NavIcon key={item.label} {...item} />
          ))}
        </div>
      </main>
    </div>
  );
}
