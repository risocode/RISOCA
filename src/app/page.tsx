'use client';

import Link from 'next/link';
import React, {useState, useEffect, useCallback} from 'react';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  limit,
} from 'firebase/firestore';
import {db} from '@/lib/firebase';
import {
  History,
  FileWarning,
  ChevronDown,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import {Skeleton} from '@/components/ui/skeleton';
import {Button} from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {Badge} from '@/components/ui/badge';
import {cn} from '@/lib/utils';
import type {SaleTransaction} from '@/lib/schemas';
import {useToast} from '@/hooks/use-toast';
import {useReceipts} from '@/contexts/ReceiptContext';
import {DailyPerformanceChart} from '@/app/components/daily-performance-chart';
import {BestSellersReport} from '@/app/components/best-sellers-report';

export default function HomePage() {
  const [recentSales, setRecentSales] = useState<SaleTransaction[]>([]);
  const [historyLimit, setHistoryLimit] = useState(5);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSalesLoading, setIsSalesLoading] = useState(true); // New state for filter loading
  const {toast} = useToast();

  const [totalSales, setTotalSales] = useState(0);
  const [isTotalsLoading, setIsTotalsLoading] = useState(true);
  const {totalSpent: totalExpenses} = useReceipts();

  const [openRecentSales, setOpenRecentSales] = useState<
    Record<string, boolean>
  >({});

  const toggleRecentSaleRow = (id: string) => {
    setOpenRecentSales((prev) => {
      const isCurrentlyOpen = !!prev[id];
      return isCurrentlyOpen ? {} : {[id]: true};
    });
  };

  const handleFirestoreError = useCallback(
    (error: Error, collectionName: string) => {
      console.error(`Error fetching ${collectionName}:`, error);
      toast({
        variant: 'destructive',
        title: 'Database Error',
        description: `Could not fetch ${collectionName}. Check rules.`,
        duration: 10000,
      });
    },
    [toast]
  );

  // Effect for fetching sales history (paginated)
  useEffect(() => {
    setIsSalesLoading(true); // Always set loading to true when filter changes
    const historyQuery = query(
      collection(db, 'saleTransactions'),
      orderBy('createdAt', 'desc'),
      limit(historyLimit)
    );
    const unsubHistory = onSnapshot(
      historyQuery,
      (snapshot) => {
        const salesData = snapshot.docs.map(
          (doc) => ({id: doc.id, ...doc.data()} as SaleTransaction)
        );
        setRecentSales(salesData);
        if (isLoadingHistory) {
          setIsLoadingHistory(false); // Only set this on the very first load
        }
        setIsSalesLoading(false); // Done loading this filter
      },
      (error) => {
        handleFirestoreError(error, 'saleTransactions (history)');
        setIsLoadingHistory(false);
        setIsSalesLoading(false);
      }
    );
    return () => unsubHistory();
  }, [historyLimit, handleFirestoreError, isLoadingHistory]);

  // Effect for fetching total sales (all time) - Runs only once
  useEffect(() => {
    const salesQuery = query(collection(db, 'saleTransactions'));
    const unsubSales = onSnapshot(
      salesQuery,
      (snapshot) => {
        const total = snapshot.docs
          .filter((doc) => doc.data().status !== 'voided')
          .reduce((acc, doc) => acc + doc.data().total, 0);
        setTotalSales(total);
        setIsTotalsLoading(false);
      },
      (error) => {
        handleFirestoreError(error, 'saleTransactions (totals)');
        setIsTotalsLoading(false);
      }
    );
    return () => unsubSales();
  }, [handleFirestoreError]);

  const formatCurrency = (value: number) =>
    `₱${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="p-4 md:p-6 space-y-6 animate-page-enter opacity-0">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Financial Summary</CardTitle>
            <CardDescription>
              Your lifetime sales and expenses at a glance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 items-center divide-x">
              <div className="flex flex-col items-center justify-center space-y-1 pr-4">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp /> Total Sales
                </p>
                {isTotalsLoading ? (
                  <Skeleton className="h-8 w-2/3 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-primary">
                    {formatCurrency(totalSales)}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-center justify-center space-y-1 pl-4">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingDown /> Total Expenses
                </p>
                {isTotalsLoading ? (
                  <Skeleton className="h-8 w-2/3 mt-1" />
                ) : (
                  <p className="text-3xl font-bold text-destructive">
                    {formatCurrency(totalExpenses)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <DailyPerformanceChart />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>Sales History</CardTitle>
                <CardDescription>
                  Your most recent transactions.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm text-muted-foreground">Show</span>
                <Button
                  variant={historyLimit === 5 ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setHistoryLimit(5)}
                  disabled={isSalesLoading}
                >
                  5
                </Button>
                <Button
                  variant={historyLimit === 10 ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setHistoryLimit(10)}
                  disabled={isSalesLoading}
                >
                  10
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingHistory ? (
                  Array.from({length: historyLimit}).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-5 w-3/4" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-3/4" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-16 mx-auto" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-1/4 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : recentSales.length > 0 ? (
                  recentSales.map((sale) => {
                    const isOpen = !!openRecentSales[sale.id];
                    return (
                      <React.Fragment key={sale.id}>
                        <TableRow
                          onClick={() => toggleRecentSaleRow(sale.id)}
                          className={cn(
                            'cursor-pointer',
                            sale.status === 'voided' && 'opacity-60'
                          )}
                        >
                          <TableCell
                            className={cn(
                              sale.status === 'voided' && 'line-through'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <ChevronDown
                                className={cn(
                                  'h-4 w-4 transition-transform',
                                  isOpen && 'rotate-180'
                                )}
                              />
                              <div>
                                <p className="font-medium">
                                  #{sale.receiptNumber}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(
                                    sale.createdAt.toDate()
                                  ).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {sale.customerName || 'Customer'}
                          </TableCell>
                          <TableCell className="text-center">
                            {sale.status === 'voided' ? (
                              <Badge variant="destructive">Voided</Badge>
                            ) : (
                              <Badge variant="success">Active</Badge>
                            )}
                          </TableCell>
                          <TableCell
                            className={cn(
                              'text-right font-mono',
                              sale.status === 'voided' && 'line-through'
                            )}
                          >
                            {formatCurrency(sale.total)}
                          </TableCell>
                        </TableRow>
                        {isOpen && (
                          <TableRow
                            className={cn(
                              'bg-muted/50',
                              sale.status === 'voided' && 'opacity-60'
                            )}
                          >
                            <TableCell colSpan={4} className="p-2">
                              <div className="p-2 bg-background rounded-md">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="h-8">
                                        Item Name
                                      </TableHead>
                                      <TableHead className="h-8 text-center w-16">
                                        Qty
                                      </TableHead>
                                      <TableHead className="h-8 text-right">
                                        Unit Price
                                      </TableHead>
                                      <TableHead className="h-8 text-right">
                                        Amount
                                      </TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {sale.items.map((item, index) => (
                                      <TableRow
                                        key={index}
                                        className="border-none"
                                      >
                                        <TableCell className="py-1 font-medium">
                                          {item.itemName}
                                        </TableCell>
                                        <TableCell className="py-1 text-center">
                                          {item.quantity}
                                        </TableCell>
                                        <TableCell className="py-1 text-right font-mono">
                                          {formatCurrency(item.unitPrice)}
                                        </TableCell>
                                        <TableCell className="py-1 text-right font-mono">
                                          {formatCurrency(item.total)}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      <FileWarning className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      No recent sales found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="flex-col items-center gap-4 pt-4">
            {historyLimit === 10 && (
              <p className="text-sm text-center text-muted-foreground">
                For more results, view the full history.
              </p>
            )}
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
              <BestSellersReport />
              <Button asChild variant="outline" className="w-full">
                <Link href="/transactions">
                  <History className="mr-2" />
                  View Full Transaction History
                </Link>
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
