'use client';

import Link from 'next/link';
import React, {useState, useEffect} from 'react';
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
import {History, FileWarning, ChevronDown} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import {Skeleton} from '@/components/ui/skeleton';
import {Separator} from '@/components/ui/separator';
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
  const [recentSales, setRecentSales] = useState<SaleTransaction[]>([]);
  const [historyLimit, setHistoryLimit] = useState(5);

  const [isLoadingTotals, setIsLoadingTotals] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const {toast} = useToast();

  const [openRecentSales, setOpenRecentSales] = useState<
    Record<string, boolean>
  >({});

  const toggleRecentSaleRow = (id: string) => {
    setOpenRecentSales((prev) => ({...prev, [id]: !prev[id]}));
  };

  const handleFirestoreError = (error: Error, collectionName: string) => {
    console.error(`Error fetching ${collectionName}:`, error);
    toast({
      variant: 'destructive',
      title: 'Database Error',
      description: `Could not fetch ${collectionName}. Check rules.`,
      duration: 10000,
    });
  };

  useEffect(() => {
    // This now queries the new saleTransactions collection for totals
    const salesQuery = query(collection(db, 'saleTransactions'));
    const unsubSales = onSnapshot(
      salesQuery,
      (snapshot) => {
        const total = snapshot.docs
          .filter((doc) => doc.data().status !== 'voided')
          .reduce((acc, doc) => acc + (doc.data().total || 0), 0);
        setTotalSales(total);
        if (isLoadingTotals) setIsLoadingTotals(false);
      },
      (error) => handleFirestoreError(error, 'saleTransactions')
    );

    const receiptsQuery = query(collection(db, 'receipts'));
    const unsubReceipts = onSnapshot(
      receiptsQuery,
      (snapshot) => {
        const total = snapshot.docs.reduce(
          (acc, doc) => acc + (doc.data().total || 0),
          0
        );
        setTotalExpenses(total);
      },
      (error) => handleFirestoreError(error, 'receipts')
    );

    setIsLoadingHistory(true);
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
        setIsLoadingHistory(false);
      },
      (error) => {
        handleFirestoreError(error, 'saleTransactions (history)');
        setIsLoadingHistory(false);
      }
    );

    return () => {
      unsubSales();
      unsubReceipts();
      unsubHistory();
    };
  }, [toast, historyLimit]);

  const formatCurrency = (value: number) =>
    `₱${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6 flex items-center justify-around">
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Total Sales
              </p>
              {isLoadingTotals ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <p className="text-3xl font-bold tracking-tighter text-primary">
                  {formatCurrency(totalSales)}
                </p>
              )}
            </div>
            <Separator orientation="vertical" className="h-16" />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Total Expenses
              </p>
              {isLoadingTotals ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <p className="text-3xl font-bold tracking-tighter text-accent">
                  {formatCurrency(totalExpenses)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

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
                >
                  5
                </Button>
                <Button
                  variant={historyLimit === 10 ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setHistoryLimit(10)}
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
                          <TableCell>{sale.customerName || 'Customer'}</TableCell>
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
                                          {item.unitPrice.toFixed(2)}
                                        </TableCell>
                                        <TableCell className="py-1 text-right font-mono">
                                          {item.total.toFixed(2)}
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
            <Button asChild variant="outline" className="w-full">
              <Link href="/store/history">
                <History className="mr-2" />
                View Full Transaction History
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
