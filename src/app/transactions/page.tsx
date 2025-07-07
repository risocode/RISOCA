
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
import {cn} from '@/lib/utils';

import {Card} from '@/components/ui/card';
import {Skeleton} from '@/components/ui/skeleton';
import {useToast} from '@/hooks/use-toast';
import {
  History,
  ReceiptText,
  ShoppingCart,
  FileWarning,
  Landmark,
} from 'lucide-react';
import type {DiagnoseReceiptOutput} from '@/ai/flows/diagnose-receipt-flow';
import {Badge} from '@/components/ui/badge';
import type {
  LedgerTransaction,
  Customer,
  SaleTransaction,
} from '@/lib/schemas';

type ReceiptDoc = DiagnoseReceiptOutput & {
  id: string;
  createdAt: Timestamp;
};

type LedgerTransactionDoc = LedgerTransaction & {
  customerName: string;
};

type UnifiedTransaction = {
  id: string;
  type: 'sale' | 'receipt' | 'ledger';
  date: Date;
  data: SaleTransaction | ReceiptDoc | LedgerTransactionDoc;
  status?: 'voided' | 'deleted' | 'active';
};

function TransactionCard({transaction}: {transaction: UnifiedTransaction}) {
  const isSale = transaction.type === 'sale';
  const isReceipt = transaction.type === 'receipt';
  const isLedger = transaction.type === 'ledger';
  const data = transaction.data;
  const isDeleted =
    transaction.status === 'deleted' || transaction.status === 'voided';

  const date = transaction.date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formatCurrency = (value: number) =>
    `₱${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  let icon: React.ReactNode;
  let title: string;
  let description: string;
  let amountDisplay: React.ReactNode;
  let badge: React.ReactNode;

  if (isSale) {
    const saleData = data as SaleTransaction;
    icon = <ShoppingCart className="w-6 h-6 text-primary" />;
    title = `Sale #${saleData.id.substring(0, 6)}`;
    description = saleData.customerName || date;
    amountDisplay = (
      <p className="font-bold text-lg text-primary">
        + {formatCurrency(saleData.total)}
      </p>
    );
    badge = isDeleted ? (
      <Badge variant="destructive">Voided</Badge>
    ) : (
      <Badge variant="secondary">Sale</Badge>
    );
  } else if (isReceipt) {
    const receiptData = data as ReceiptDoc;
    icon = <ReceiptText className="w-6 h-6 text-accent" />;
    title = receiptData.merchantName;
    description = date;
    amountDisplay = (
      <p className="font-bold text-lg text-accent">
        - {formatCurrency(receiptData.total)}
      </p>
    );
    badge = <Badge variant="outline">{receiptData.category}</Badge>;
  } else if (isLedger) {
    const ledgerData = data as LedgerTransactionDoc;
    const isCredit = ledgerData.type === 'credit';
    icon = (
      <Landmark
        className={`w-6 h-6 ${
          isCredit ? 'text-destructive' : 'text-success'
        }`}
      />
    );
    title = isCredit
      ? `Credit to ${ledgerData.customerName}`
      : `Payment from ${ledgerData.customerName}`;
    description = ledgerData.description || date;
    amountDisplay = (
      <p
        className={`font-bold text-lg ${
          isCredit ? 'text-destructive' : 'text-success'
        }`}
      >
        {isCredit ? '+' : '-'} {formatCurrency(ledgerData.amount)}
      </p>
    );
    badge = isDeleted ? (
      <Badge variant="destructive">Deleted</Badge>
    ) : (
      <Badge variant={isCredit ? 'destructive' : 'success'}>
        {ledgerData.type}
      </Badge>
    );
  }

  return (
    <Card
      className={cn(
        'flex items-center p-4 gap-4',
        isDeleted && 'opacity-60 bg-muted/50'
      )}
    >
      <div className="flex-shrink-0 bg-muted rounded-lg w-12 h-12 flex items-center justify-center">
        {icon!}
      </div>
      <div className="flex-grow grid grid-cols-2 gap-x-4 items-center">
        <div>
          <p
            className={cn('font-semibold truncate', isDeleted && 'line-through')}
          >
            {title!}
          </p>
          <p className="text-sm text-muted-foreground">{description!}</p>
        </div>
        <div className="text-right">
          <div className={cn(isDeleted && 'line-through')}>{amountDisplay}</div>
          {badge}
        </div>
      </div>
    </Card>
  );
}

export default function TransactionsPage() {
  const [sales, setSales] = useState<SaleTransaction[]>([]);
  const [receipts, setReceipts] = useState<ReceiptDoc[]>([]);
  const [ledger, setLedger] = useState<LedgerTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const {toast} = useToast();

  useEffect(() => {
    const queries = [
      {
        name: 'sales',
        query: query(
          collection(db, 'saleTransactions'),
          orderBy('createdAt', 'desc')
        ),
        setter: setSales,
      },
      {
        name: 'receipts',
        query: query(collection(db, 'receipts'), orderBy('createdAt', 'desc')),
        setter: setReceipts,
      },
      {
        name: 'ledger',
        query: query(collection(db, 'ledger'), orderBy('createdAt', 'desc')),
        setter: setLedger,
      },
      {
        name: 'customers',
        query: query(collection(db, 'customers')),
        setter: setCustomers,
      },
    ];

    let initialLoads = queries.length;
    const unsubscribes = queries.map(({name, query, setter}) => {
      return onSnapshot(
        query,
        (snapshot) => {
          setter(
            snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()})) as any
          );
          if (initialLoads > 0) {
            initialLoads--;
            if (initialLoads === 0) {
              setIsLoading(false);
            }
          }
        },
        (error) => {
          console.error(`Error fetching ${name}:`, error);
          toast({
            variant: 'destructive',
            title: 'Database Error',
            description: `Could not fetch ${name} data.`,
          });
          if (initialLoads > 0) {
            initialLoads--;
            if (initialLoads === 0) {
              setIsLoading(false);
            }
          }
        }
      );
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [toast]);

  const transactions = useMemo(() => {
    const customerMap = new Map(customers.map((c) => [c.id, c.name]));

    const salesTx: UnifiedTransaction[] = sales.map((s) => ({
      id: s.id,
      type: 'sale',
      date: s.createdAt.toDate(),
      data: s,
      status: s.status,
    }));

    const receiptsTx: UnifiedTransaction[] = receipts.map((r) => ({
      id: r.id,
      type: 'receipt',
      date: r.createdAt.toDate(),
      data: r,
      status: 'active',
    }));

    const ledgerTx: UnifiedTransaction[] = ledger.map((l) => ({
      id: l.id,
      type: 'ledger',
      date: l.createdAt.toDate(),
      data: {
        ...l,
        customerName: customerMap.get(l.customerId) || 'Unknown Customer',
      } as LedgerTransactionDoc,
      status: l.status,
    }));

    const allData = [...salesTx, ...receiptsTx, ...ledgerTx];
    allData.sort((a, b) => b.date.getTime() - a.date.getTime());
    return allData;
  }, [sales, receipts, ledger, customers]);

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
            <TransactionCard key={`${tx.type}-${tx.id}`} transaction={tx} />
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
