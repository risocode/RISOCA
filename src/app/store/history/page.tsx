'use client';

import {useState, useEffect} from 'react';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  type Timestamp,
} from 'firebase/firestore';
import {db} from '@/lib/firebase';
import {voidSaleTransaction, type SaleTransaction} from '@/app/actions';

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
import {History, Trash2, Loader2} from 'lucide-react';
import {Skeleton} from '@/components/ui/skeleton';
import {cn} from '@/lib/utils';
import {Badge} from '@/components/ui/badge';
import type { SaleItem } from '@/lib/schemas';

type SaleDoc = SaleItem & {
  id: string;
  createdAt: Timestamp;
  status?: 'active' | 'voided';
};

export default function SalesHistoryPage() {
  const [allSales, setAllSales] = useState<SaleDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidingSale, setVoidingSale] = useState<SaleDoc | null>(null);
  const {toast} = useToast();

  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, 'sales'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const salesFromDb: SaleDoc[] = [];
        querySnapshot.forEach((doc) => {
          salesFromDb.push({
            id: doc.id,
            ...(doc.data() as Omit<SaleDoc, 'id'>),
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
          description: 'Could not fetch sales data.',
        });
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [toast]);

  const handleOpenAlert = (sale: SaleDoc) => {
    setVoidingSale(sale);
    setIsAlertOpen(true);
  };

  const handleVoidSale = async () => {
    if (!voidingSale) return;

    setIsVoiding(true);
    // This page voids single items, which is legacy.
    // The new flow uses voidSaleTransaction.
    // We would need a way to find the parent transaction to void it.
    // For now, this will fail if it's part of a new transaction.
    // A proper fix would require migrating all sales to the new model.
    toast({
      variant: 'destructive',
      title: 'Action Not Supported',
      description: 'Voiding from this page is not supported for new transactions.',
    });

    setIsVoiding(false);
    setIsAlertOpen(false);
    setVoidingSale(null);
  };

  const totalRevenue = allSales
    .filter((sale) => sale.status !== 'voided')
    .reduce((acc, sale) => acc + sale.total, 0);

  return (
    <>
      <div className="flex flex-1 flex-col p-4 md:p-6 space-y-4">
        <header>
          <h1 className="text-2xl font-bold">Sales Reports</h1>
        </header>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" /> All Transactions
            </CardTitle>
            <CardDescription>
              Showing {allSales.length} total transactions with a revenue of{' '}
              <span className="font-mono font-semibold text-primary">
                ₱{totalRevenue.toFixed(2)}
              </span>
              . Voided sales are excluded from revenue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Date</TableHead>
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
                          <Skeleton className="h-8 w-10 ml-auto" />
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
                          <p className="font-medium">{sale.itemName}</p>
                          <p className="text-xs text-muted-foreground">
                            {sale.quantity} x ₱{sale.unitPrice.toFixed(2)}
                          </p>
                        </TableCell>
                        <TableCell
                          className={cn(
                            sale.status === 'voided' && 'line-through'
                          )}
                        >
                          {sale.createdAt
                            .toDate()
                            .toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
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
                          ₱{sale.total.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenAlert(sale)}
                            aria-label="Void Sale"
                            disabled={sale.status === 'voided'}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
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
              and restore the sold quantity back to inventory (if applicable).
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
