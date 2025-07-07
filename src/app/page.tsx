'use client';

import Link from 'next/link';
import {useState, useEffect} from 'react';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  where,
  limit,
  Timestamp,
} from 'firebase/firestore';
import {db} from '@/lib/firebase';
import {
  History,
  FileWarning
} from 'lucide-react';
import {Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter} from '@/components/ui/card';
import {Skeleton} from '@/components/ui/skeleton';
import {Separator} from '@/components/ui/separator';
import {Button} from '@/components/ui/button';
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from '@/components/ui/table';

type SaleDoc = {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: Timestamp;
};

export default function HomePage() {
  const [totalSales, setTotalSales] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [dailySales, setDailySales] = useState(0);
  const [todaysSalesList, setTodaysSalesList] = useState<SaleDoc[]>([]);
  const [recentSales, setRecentSales] = useState<SaleDoc[]>([]);
  
  const [isLoadingTotals, setIsLoadingTotals] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);


  useEffect(() => {
    const salesQuery = query(collection(db, 'sales'));
    const unsubSales = onSnapshot(salesQuery, (snapshot) => {
      const total = snapshot.docs.reduce((acc, doc) => acc + (doc.data().total || 0), 0);
      setTotalSales(total);
      if(isLoadingTotals) setIsLoadingTotals(false);
    });

    const receiptsQuery = query(collection(db, 'receipts'));
    const unsubReceipts = onSnapshot(receiptsQuery, (snapshot) => {
      const total = snapshot.docs.reduce((acc, doc) => acc + (doc.data().total || 0), 0);
      setTotalExpenses(total);
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dailyQuery = query(
      collection(db, 'sales'),
      where('createdAt', '>=', Timestamp.fromDate(today)),
      orderBy('createdAt', 'desc')
    );
    const unsubDaily = onSnapshot(dailyQuery, (snapshot) => {
      const salesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SaleDoc));
      const total = salesData.reduce((acc, sale) => acc + sale.total, 0);
      setDailySales(total);
      setTodaysSalesList(salesData);
    });

    const historyQuery = query(collection(db, 'sales'), orderBy('createdAt', 'desc'), limit(5));
    const unsubHistory = onSnapshot(historyQuery, (snapshot) => {
      const salesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SaleDoc));
      setRecentSales(salesData);
      if(isLoadingHistory) setIsLoadingHistory(false);
    });

    return () => {
      unsubSales();
      unsubReceipts();
      unsubDaily();
      unsubHistory();
    };
  }, [isLoadingTotals, isLoadingHistory]);

  const formatCurrency = (value: number) =>
    `₱${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

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
              {isLoadingTotals ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <p className="text-3xl font-bold tracking-tighter text-primary">{formatCurrency(totalSales)}</p>
              )}
            </div>
            <Separator orientation="vertical" className="h-16" />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Total Expenses</p>
              {isLoadingTotals ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <p className="text-3xl font-bold tracking-tighter text-accent">{formatCurrency(totalExpenses)}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Today's Sales</CardTitle>
                        <CardDescription>Total revenue for today.</CardDescription>
                    </div>
                     {isLoadingTotals ? (
                        <Skeleton className="h-8 w-32" />
                      ) : (
                        <div className="text-2xl font-bold text-primary">{formatCurrency(dailySales)}</div>
                      )}
                </div>
            </CardHeader>
            <CardContent className="p-0">
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoadingTotals ? (
                            Array.from({length: 3}).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-1/4 ml-auto" /></TableCell>
                                </TableRow>
                            ))
                        ) : todaysSalesList.length > 0 ? (
                           todaysSalesList.map((sale) => (
                               <TableRow key={sale.id}>
                                   <TableCell>
                                       <p className="font-medium">{sale.itemName}</p>
                                       <p className="text-xs text-muted-foreground">
                                           {new Date(sale.createdAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                                       </p>
                                   </TableCell>
                                   <TableCell className="text-right font-mono">
                                        {formatCurrency(sale.total)}
                                   </TableCell>
                               </TableRow>
                           ))
                        ) : (
                             <TableRow>
                                <TableCell colSpan={2} className="h-24 text-center">
                                    <FileWarning className="w-8 h-8 mx-auto text-muted-foreground mb-2"/>
                                    No sales recorded today.
                                </TableCell>
                             </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Recent Sales History</CardTitle>
                <CardDescription>Your last 5 transactions.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoadingHistory ? (
                            Array.from({length: 5}).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-1/4 ml-auto" /></TableCell>
                                </TableRow>
                            ))
                        ) : recentSales.length > 0 ? (
                           recentSales.map((sale) => (
                               <TableRow key={sale.id}>
                                   <TableCell>
                                       <p className="font-medium">{sale.itemName}</p>
                                       <p className="text-xs text-muted-foreground">
                                           {new Date(sale.createdAt.toDate()).toLocaleDateString()}
                                       </p>
                                   </TableCell>
                                   <TableCell className="text-right font-mono">
                                        {formatCurrency(sale.total)}
                                   </TableCell>
                               </TableRow>
                           ))
                        ) : (
                             <TableRow>
                                <TableCell colSpan={2} className="h-24 text-center">
                                    <FileWarning className="w-8 h-8 mx-auto text-muted-foreground mb-2"/>
                                    No recent sales found.
                                </TableCell>
                             </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
            <CardFooter className="pt-4">
                <Button asChild variant="outline" className="w-full">
                    <Link href="/transactions">
                        <History className="mr-2" />
                        View Full Transaction History
                    </Link>
                </Button>
            </CardFooter>
        </Card>

      </main>
    </div>
  );
}
