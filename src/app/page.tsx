
'use client';

import Link from 'next/link';
import {useState, useEffect} from 'react';
import Image from 'next/image';
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
import {Badge} from '@/components/ui/badge';
import {cn} from '@/lib/utils';

type SaleDoc = {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: Timestamp;
  status?: 'active' | 'voided';
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
      const total = snapshot.docs
        .filter(doc => doc.data().status !== 'voided')
        .reduce((acc, doc) => acc + (doc.data().total || 0), 0);
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
      const total = salesData
        .filter(sale => sale.status !== 'voided')
        .reduce((acc, sale) => acc + sale.total, 0);
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
      <header className="flex items-center justify-start">
        <Image
          src="/logo.png?v=3"
          alt="App Logo"
          width={40}
          height={40}
          priority
          data-ai-hint="abstract logo"
          className="w-auto h-9"
        />
        <Image
          src="/risoca.png"
          alt="RiSoCa Logo Text"
          width={120}
          height={37}
          priority
          data-ai-hint="text logo"
          className="w-auto h-8"
        />
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
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoadingTotals ? (
                            Array.from({length: 3}).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-1/4 ml-auto" /></TableCell>
                                </TableRow>
                            ))
                        ) : todaysSalesList.length > 0 ? (
                           todaysSalesList.map((sale) => (
                               <TableRow key={sale.id} className={cn(sale.status === 'voided' && 'opacity-60')}>
                                   <TableCell className={cn(sale.status === 'voided' && 'line-through')}>
                                       <p className="font-medium">{sale.itemName}</p>
                                       <p className="text-xs text-muted-foreground">
                                           {new Date(sale.createdAt.toDate()).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                                       </p>
                                   </TableCell>
                                   <TableCell>
                                      {sale.status === 'voided' ? (
                                        <Badge variant="destructive">Voided</Badge>
                                      ) : (
                                        <Badge variant="secondary">Active</Badge>
                                      )}
                                   </TableCell>
                                   <TableCell className={cn("text-right font-mono", sale.status === 'voided' && 'line-through')}>
                                        {formatCurrency(sale.total)}
                                   </TableCell>
                               </TableRow>
                           ))
                        ) : (
                             <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center">
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
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoadingHistory ? (
                            Array.from({length: 5}).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-1/4 ml-auto" /></TableCell>
                                </TableRow>
                            ))
                        ) : recentSales.length > 0 ? (
                           recentSales.map((sale) => (
                               <TableRow key={sale.id} className={cn(sale.status === 'voided' && 'opacity-60')}>
                                   <TableCell className={cn(sale.status === 'voided' && 'line-through')}>
                                       <p className="font-medium">{sale.itemName}</p>
                                       <p className="text-xs text-muted-foreground">
                                           {new Date(sale.createdAt.toDate()).toLocaleDateString()}
                                       </p>
                                   </TableCell>
                                   <TableCell>
                                        {sale.status === 'voided' ? (
                                          <Badge variant="destructive">Voided</Badge>
                                        ) : (
                                          <Badge variant="secondary">Active</Badge>
                                        )}
                                   </TableCell>
                                   <TableCell className={cn("text-right font-mono", sale.status === 'voided' && 'line-through')}>
                                        {formatCurrency(sale.total)}
                                   </TableCell>
                               </TableRow>
                           ))
                        ) : (
                             <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center">
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
