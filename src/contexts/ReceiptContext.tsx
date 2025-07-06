'use client';

import {createContext, useContext, useState, type ReactNode} from 'react';
import {type DiagnoseReceiptOutput} from '@/ai/flows/diagnose-receipt-flow';

export type Receipt = DiagnoseReceiptOutput & {
  id: string;
  imagePreview: string;
};

interface ReceiptContextType {
  receipts: Receipt[];
  addReceipt: (receipt: Receipt) => void;
  totalSpent: number;
  categories: Record<string, number>;
}

const ReceiptContext = createContext<ReceiptContextType | undefined>(undefined);

export function ReceiptsProvider({children}: {children: ReactNode}) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);

  const addReceipt = (receipt: Receipt) => {
    setReceipts((prevReceipts) => [receipt, ...prevReceipts]);
  };

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
    <ReceiptContext.Provider
      value={{receipts, addReceipt, totalSpent, categories}}
    >
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
