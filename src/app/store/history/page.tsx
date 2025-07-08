
'use client';

import {useState, useEffect} from 'react';
import Link from 'next/link';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
} from 'firebase/firestore';
import {db} from '@/lib/firebase';
import {voidSaleTransaction} from '@/app/actions';
import type {SaleTransaction} from '@/lib/schemas';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {Button} from '@/components/ui/button';
import {useToast} from '@/hooks/use-toast';
import {History, Trash2, Loader2, Printer} from 'lucide-react';
import {Skeleton} from '@/components/ui/skeleton';
import {cn} from '@/lib/utils';
import {Badge} from '@/components/ui/badge';

export default function SalesHistoryPage() {
  const [allSales, setAllSales] = useState<SaleTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidingSale, setVoidingSale] = useState<SaleTransaction | null>(null);
  const {toast} = useToast();

  useEffect(() => {
    setIsLoading(true);
    // Corrected query for 'saleTransactions' collection
    const q = query(
      collection(db, 'saleTransactions'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const salesFromDb: SaleTransaction[] = [];
        querySnapshot.forEach((doc) => {
          salesFromDb.push({
            id: doc.id,
            ...(doc.data() as Omit<SaleTransaction, 'id'>),
          });
        });
        setAllSales(salesFromDb);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching sales from Firestore:', error);
        toast({
          variant: 'destructive',
          title: 'Database Error',
          description: 'Could not fetch sales.',
        });
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [toast]);

  const handleOpenAlert = (sale: SaleTransaction) => {
    setVoidingSale(sale);
    setIsAlertOpen(true);
  };

  const handleVoidSale = async () => {
    if (!voidingSale) return;

    setIsVoiding(true);
    const response = await voidSaleTransaction(voidingSale.id);

    if (response.success) {
      toast({
        variant: 'destructive',
        title: 'Transaction Voided',
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: response.message || 'An unknown error occurred.',
      });
    }

    setIsVoiding(false);
    setIsAlertOpen(false);
    setVoidingSale(null);
  };

  const totalRevenue = allSales
    .filter((sale) => sale.status !== 'voided')
    .reduce((acc, sale) => acc + sale.total, 0);

  const formatCurrency = (value: number) =>
    `₱${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <>
      <div className="flex flex-1 flex-col p-4 md:p-6 space-y-4">
        <header>
          <h1 className="text-2xl font-bold">Sales Reports</h1>
        </header>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" /> All Sales Transactions
            </CardTitle>
            <CardDescription>
              Showing {allSales.length} total transactions with a revenue of{' '}
              <span className="font-mono font-semibold text-primary">
                {formatCurrency(totalRevenue)}
              </span>
              . Voided sales are excluded from revenue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({length: 10}).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-5 w-3/4" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-1/2" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-16" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Skeleton className="h-5 w-1/4 ml-auto" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Skeleton className="h-8 w-20 ml-auto" />
                        </TableCell>
                      </TableRow>
                    ))
                  : allSales.length > 0
                  ? allSales.map((sale) => (
                      <TableRow
                        key={sale.id}
                        className={cn(sale.status === 'voided' && 'opacity-60')}
                      >
                        <TableCell
                          className={cn(
                            sale.status === 'voided' && 'line-through'
                          )}
                        >
                          <p className="font-medium">
                            #{sale.receiptNumber}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {sale.createdAt
                              .toDate()
                              .toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                          </p>
                        </TableCell>
                        <TableCell
                          className={cn(
                            sale.status === 'voided' && 'line-through'
                          )}
                        >
                          {sale.customerName || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {sale.status === 'voided' ? (
                            <Badge variant="destructive">Voided</Badge>
                          ) : (
                            <Badge variant="secondary">Active</Badge>
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
                        <TableCell className="text-right">
                          {sale.status !== 'voided' && (
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" asChild>
                                <Link
                                  href={`/print/receipt/${sale.id}`}
                                  target="_blank"
                                >
                                  <Printer className="w-4 h-4 mr-2" />
                                  Print
                                </Link>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenAlert(sale);
                                }}
                                aria-label="Void Sale"
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  : !isLoading && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-muted-foreground h-24"
                        >
                          No sales history yet.
                        </TableCell>
                      </TableRow>
                    )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently void the sale
              and restore the sold quantity back to inventory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setVoidingSale(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleVoidSale}
              disabled={isVoiding}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isVoiding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Void Sale
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
