'use client';

import {useState, useEffect} from 'react';
import Link from 'next/link';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  type Timestamp,
} from 'firebase/firestore';
import {db} from '@/lib/firebase';
import {voidSale, type SaleItem} from '@/app/actions';

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

type SaleDoc = SaleItem & {
  id: string;
  createdAt: Timestamp;
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
    const {createdAt, ...saleToVoid} = voidingSale;
    const response = await voidSale(saleToVoid);

    if (response.success) {
      toast({
        title: 'Sale Voided',
        description:
          'The sale has been removed and stock has been restored to inventory.',
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Voiding Failed',
        description: response.message || 'An unknown error occurred.',
      });
    }

    setIsVoiding(false);
    setIsAlertOpen(false);
    setVoidingSale(null);
  };

  const totalRevenue = allSales.reduce((acc, sale) => acc + sale.total, 0);

  return (
    <>
      <div className="flex flex-1 flex-col p-4 md:p-6 space-y-6">
        <header>
          <h1 className="text-3xl font-bold">Sales Reports</h1>
          <p className="text-muted-foreground">
            A complete log of all your recorded sales.
          </p>
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
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({length: 10}).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-1/2" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-5 w-1/4 ml-auto" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-10 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  : allSales.length > 0
                  ? allSales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell>
                          <p className="font-medium">{sale.itemName}</p>
                          <p className="text-xs text-muted-foreground">
                            {sale.quantity} x ₱{sale.unitPrice.toFixed(2)}
                          </p>
                        </TableCell>
                        <TableCell>
                          {sale.createdAt
                            .toDate()
                            .toLocaleDateString(undefined, {
                              year: 'numeric', month: 'short', day: 'numeric',
                            })}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ₱{sale.total.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenAlert(sale)}
                            aria-label="Void Sale"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  : !isLoading && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground h-24">
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
