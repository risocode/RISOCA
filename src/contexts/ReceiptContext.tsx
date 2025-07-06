'use client';

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
  useEffect,
} from 'react';
import {type DiagnoseReceiptOutput} from '@/ai/flows/diagnose-receipt-flow';
import {db} from '@/lib/firebase';
import {collection, query, onSnapshot, orderBy} from 'firebase/firestore';
import {useToast} from '@/hooks/use-toast';

export type Receipt = DiagnoseReceiptOutput & {
  id: string;
  imagePreview?: string;
};

interface ReceiptContextType {
  receipts: Receipt[];
  totalSpent: number;
  categories: Record<string, number>;
}

const ReceiptContext = createContext<ReceiptContextType | undefined>(undefined);

export function ReceiptsProvider({children}: {children: ReactNode}) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const {toast} = useToast();

  // Load from firestore on initial mount and listen for updates
  useEffect(() => {
    const q = query(collection(db, 'receipts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const receiptsFromDb: Receipt[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          // Note: The document shape in Firestore should match this.
          // createdAt is added in actions.ts but not used here directly.
          receiptsFromDb.push({
            id: doc.id,
            merchantName: data.merchantName,
            transactionDate: data.transactionDate,
            total: data.total,
            items: data.items,
            category: data.category,
            imagePreview: data.imagePreview,
          });
        });
        setReceipts(receiptsFromDb);
      },
      (error) => {
        console.error('Error fetching receipts from Firestore:', error);
        toast({
          variant: 'destructive',
          title: 'Database Connection Error',
          description:
            'Could not connect to Firestore. Please check your security rules in the Firebase console and refresh the page.',
        });
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [toast]);

  const totalSpent = receipts.reduce(
    (total, receipt) => total + receipt.total,
    0
  );

  const categories = receipts.reduce(
    (acc, receipt) => {
      acc[receipt.category] = (acc[receipt.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <ReceiptContext.Provider value={{receipts, totalSpent, categories}}>
      {children}
    </ReceiptContext.Provider>
  );
}

export function useReceipts() {
  const context = useContext(ReceiptContext);
  if (context === undefined) {
    throw new Error('useReceipts must be used within a ReceiptsProvider');
  }
  return context;
}
