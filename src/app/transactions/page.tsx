'use client';

import {useState, useEffect, useMemo} from 'react';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  type Timestamp,
} from 'firebase/firestore';
import {db} from '@/lib/firebase';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {Skeleton} from '@/components/ui/skeleton';
import {useToast} from '@/hooks/use-toast';
import {
  History,
  ReceiptText,
  ShoppingCart,
  FileWarning,
} from 'lucide-react';
import type {DiagnoseReceiptOutput} from '@/ai/flows/diagnose-receipt-flow';
import {Badge} from '@/components/ui/badge';

type SaleDoc = {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: Timestamp;
};

type ReceiptDoc = DiagnoseReceiptOutput & {
  id: string;
  createdAt: Timestamp;
};

type UnifiedTransaction = {
  id: string;
  type: 'sale' | 'receipt';
  date: Date;
  data: SaleDoc | ReceiptDoc;
};

function TransactionCard({transaction}: {transaction: UnifiedTransaction}) {
  const isSale = transaction.type === 'sale';
  const data = transaction.data;

  const title = isSale ? (data as SaleDoc).itemName : data.merchantName;
  const total = data.total;
  const date = transaction.date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Card className="flex items-center p-4 gap-4">
      <div className="flex-shrink-0 bg-muted rounded-lg w-12 h-12 flex items-center justify-center">
        {isSale ? (
          <ShoppingCart className="w-6 h-6 text-primary" />
        ) : (
          <ReceiptText className="w-6 h-6 text-accent" />
        )}
      </div>
      <div className="flex-grow grid grid-cols-2 gap-x-4 items-center">
        <div>
          <p className="font-semibold truncate">{title}</p>
          <p className="text-sm text-muted-foreground">{date}</p>
        </div>
        <div className="text-right">
          <p
            className={`font-bold text-lg ${
              isSale ? 'text-primary' : 'text-accent'
            }`}
          >
            {isSale ? '+' : '-'} ₱
            {total.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          {isSale ? (
            <Badge variant="secondary">Sale</Badge>
          ) : (
            <Badge variant="outline">{(data as ReceiptDoc).category}</Badge>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const {toast} = useToast();

  useEffect(() => {
    setIsLoading(true);

    const salesQuery = query(collection(db, 'sales'), orderBy('createdAt', 'desc'));
    const receiptsQuery = query(collection(db, 'receipts'), orderBy('createdAt', 'desc'));

    let salesData: UnifiedTransaction[] = [];
    let receiptsData: UnifiedTransaction[] = [];
    let salesDone = false;
    let receiptsDone = false;

    const combineAndSet = () => {
      const allData = [...salesData, ...receiptsData];
      allData.sort((a, b) => b.date.getTime() - a.date.getTime());
      setTransactions(allData);
      if(salesDone && receiptsDone) {
        setIsLoading(false);
      }
    };

    const unsubSales = onSnapshot(
      salesQuery,
      (snapshot) => {
        salesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          type: 'sale',
          date: (doc.data().createdAt as Timestamp).toDate(),
          data: {id: doc.id, ...doc.data()} as SaleDoc,
        }));
        salesDone = true;
        combineAndSet();
      },
      (error) => {
        console.error('Error fetching sales:', error);
        toast({
          variant: 'destructive',
          title: 'Database Error',
          description: 'Could not fetch sales data.',
        });
        salesDone = true;
        if(receiptsDone) setIsLoading(false);
      }
    );

    const unsubReceipts = onSnapshot(
      receiptsQuery,
      (snapshot) => {
        receiptsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          type: 'receipt',
          date: (doc.data().createdAt as Timestamp).toDate(),
          data: {id: doc.id, ...doc.data()} as ReceiptDoc,
        }));
        receiptsDone = true;
        combineAndSet();
      },
      (error) => {
        console.error('Error fetching receipts:', error);
        toast({
          variant: 'destructive',
          title: 'Database Error',
          description: 'Could not fetch receipts data.',
        });
        receiptsDone = true;
        if(salesDone) setIsLoading(false);
      }
    );

    return () => {
      unsubSales();
      unsubReceipts();
    };
  }, [toast]);

  return (
    <div className="flex flex-1 flex-col p-4 md:p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <History /> Transactions
        </h1>
      </header>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({length: 5}).map((_, i) => (
            <Card key={i} className="flex items-center p-4 gap-4">
              <Skeleton className="w-12 h-12 rounded-lg" />
              <div className="flex-grow grid grid-cols-2 gap-x-4 items-center">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
                <div className="space-y-2 text-right">
                   <Skeleton className="h-6 w-1/2 ml-auto" />
                   <Skeleton className="h-5 w-1/4 ml-auto" />
                </div>
              </div>
            </Card>
          ))
        ) : transactions.length > 0 ? (
          transactions.map((tx) => (
            <TransactionCard key={tx.id} transaction={tx} />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-10 border-2 border-dashed rounded-lg min-h-[400px]">
            <FileWarning className="w-12 h-12 mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold">No Transactions Found</h2>
            <p className="max-w-xs mt-2 text-muted-foreground">
              Your sales and expenses will appear here once you add them.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
