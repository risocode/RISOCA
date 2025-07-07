'use client';

import Link from 'next/link';
import {useState, useEffect, useMemo} from 'react';
import {
  collection,
  query,
  onSnapshot,
} from 'firebase/firestore';
import {db} from '@/lib/firebase';
import {cn} from '@/lib/utils';

import {
  ReceiptText,
  Store as StoreIcon,
  BarChart3,
  Landmark,
} from 'lucide-react';

import {Card, CardContent} from '@/components/ui/card';
import {Skeleton} from '@/components/ui/skeleton';
import {Separator} from '@/components/ui/separator';

const ActionButton = ({
  href,
  icon: Icon,
  label,
  colorClass,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  colorClass: string;
}) => (
  <Link
    href={href}
    className="flex flex-col items-center justify-center space-y-2 group"
  >
    <div
      className={cn(
        'flex items-center justify-center w-16 h-16 rounded-2xl transition-all group-hover:scale-105 shadow-md',
        colorClass
      )}
    >
      <Icon className="w-8 h-8 text-white" />
    </div>
    <p className="text-xs font-semibold text-foreground">{label}</p>
  </Link>
);

export default function HomePage() {
  const [sales, setSales] = useState<{ total: number }[]>([]);
  const [receipts, setReceipts] = useState<{ total: number }[]>([]);
  const [isLoadingSales, setIsLoadingSales] = useState(true);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(true);

  useEffect(() => {
    const salesQuery = query(collection(db, 'sales'));
    const unsubSales = onSnapshot(
      salesQuery,
      (snapshot) => {
        const salesData = snapshot.docs.map(
          (doc) => doc.data() as { total: number }
        );
        setSales(salesData);
        setIsLoadingSales(false);
      },
      (err) => {
        console.error('Firebase sales snapshot error:', err);
        setIsLoadingSales(false);
      }
    );

    const receiptsQuery = query(collection(db, 'receipts'));
    const unsubReceipts = onSnapshot(
      receiptsQuery,
      (snapshot) => {
        const receiptsData = snapshot.docs.map(
          (doc) => doc.data() as { total: number }
        );
        setReceipts(receiptsData);
        setIsLoadingExpenses(false);
      },
      (err) => {
        console.error('Firebase receipts snapshot error:', err);
        setIsLoadingExpenses(false);
      }
    );

    return () => {
      unsubSales();
      unsubReceipts();
    };
  }, []);

  const totalSales = useMemo(() => {
    return sales.reduce((acc, sale) => acc + sale.total, 0);
  }, [sales]);

  const totalExpenses = useMemo(() => {
    return receipts.reduce((acc, receipt) => acc + receipt.total, 0);
  }, [receipts]);

  const formatCurrency = (value: number) =>
    `₱${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const quickActions = [
    {
      href: '/store/ledger',
      icon: Landmark,
      label: 'Credit',
      color: 'bg-gradient-to-br from-purple-500 to-indigo-600',
    },
    {
      href: '/store/receipts',
      icon: ReceiptText,
      label: 'Expenses',
      color: 'bg-gradient-to-br from-pink-500 to-rose-500',
    },
    {
      href: '/store',
      icon: StoreIcon,
      label: 'POS',
      color: 'bg-gradient-to-br from-blue-500 to-cyan-500',
    },
    {
      href: '/store/history',
      icon: BarChart3,
      label: 'Reports',
      color: 'bg-gradient-to-br from-green-500 to-emerald-500',
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <svg
            width="32"
            height="32"
            viewBox="0 0 125 125"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M110.5 40.5C110.5 40.5 88.5 61.5 88.5 77.5C88.5 93.5 102 101.5 110.5 103.5C110.5 103.5 96 111 81.5 103.5C67 96 62.5 80.5 62.5 62.5C62.5 44.5 48 37.5 35 37.5C22 37.5 14.5 48.5 14.5 62.5C14.5 76.5 22 88.5 35 88.5"
              stroke="hsl(var(--primary))"
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M93 22C93 22 71 43 71 59C71 75 84.5 83 93 85C93 85 78.5 92.5 64 85C49.5 77.5 45 62 45 44C45 26 30.5 19 17.5 19C4.5 19 -3 30 -3 44C-3 58 4.5 70 17.5 70"
              stroke="hsl(var(--accent))"
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <h1 className="text-2xl font-bold text-primary">RiSoCa</h1>
        </div>
      </header>

      <main className="space-y-6">
        <Card>
          <CardContent className="pt-6 flex items-center justify-around">
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Total Sales</p>
              {isLoadingSales ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <p className="text-3xl font-bold tracking-tighter text-primary">{formatCurrency(totalSales)}</p>
              )}
            </div>
            <Separator orientation="vertical" className="h-16" />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Total Expenses</p>
              {isLoadingExpenses ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <p className="text-3xl font-bold tracking-tighter text-accent">{formatCurrency(totalExpenses)}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 grid grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <ActionButton key={action.href} {...action} />
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
