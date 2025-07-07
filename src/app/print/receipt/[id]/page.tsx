'use client';

import {useState, useEffect} from 'react';
import {useParams} from 'next/navigation';
import {doc, getDoc} from 'firebase/firestore';
import {db} from '@/lib/firebase';
import type {SaleTransaction} from '@/lib/schemas';
import {Loader2} from 'lucide-react';
import {format} from 'date-fns';

export default function PrintReceiptPage() {
  const params = useParams();
  const receiptId = params.id as string;
  const [transaction, setTransaction] = useState<SaleTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!receiptId) return;

    const fetchTransaction = async () => {
      try {
        setLoading(true);
        const docRef = doc(db, 'saleTransactions', receiptId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setTransaction({id: docSnap.id, ...docSnap.data()} as SaleTransaction);
        } else {
          setError('Receipt not found.');
        }
      } catch (err) {
        console.error('Error fetching receipt:', err);
        setError('An error occurred while fetching the receipt data.');
      } finally {
        setLoading(false);
      }
    };

    fetchTransaction();
  }, [receiptId]);

  useEffect(() => {
    if (transaction && !loading && !error) {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [transaction, loading, error]);

  const formatCurrency = (value: number) =>
    `₱${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-600 font-bold">
        {error}
      </div>
    );
  }

  if (!transaction) {
    return null;
  }
  
  const receiptDate = transaction.createdAt.toDate();

  return (
    <div className="p-4 bg-white text-black font-mono text-xs max-w-xs mx-auto">
      <header className="text-center mb-4">
        <h1 className="font-bold text-sm">RiSoCa Store</h1>
        <p>228 Divisoria Enrile Cagayan</p>
      </header>
      <div className="flex justify-between border-t border-b border-dashed border-black py-1">
         <span>{format(receiptDate, 'MM/dd/yyyy')}</span>
         <span>{format(receiptDate, 'hh:mm a')}</span>
      </div>
      <div className="my-2">
        <p>Receipt #: {transaction.id.substring(0,8).toUpperCase()}</p>
        {transaction.customerName && <p>Customer: {transaction.customerName}</p>}
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-dashed border-black">
            <th className="text-left py-1">Item</th>
            <th className="text-center">Qty</th>
            <th className="text-right">Price</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {transaction.items.map((item, index) => (
            <tr key={index}>
              <td className="py-0.5">{item.itemName}</td>
              <td className="text-center">{item.quantity}</td>
              <td className="text-right">{item.unitPrice.toFixed(2)}</td>
              <td className="text-right">{item.total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 pt-2 border-t border-black">
        <div className="flex justify-between font-bold text-sm">
            <span>Total:</span>
            <span>{formatCurrency(transaction.total)}</span>
        </div>
      </div>
      <footer className="text-center mt-6">
        <p>Thank you for your business!</p>
      </footer>
    </div>
  );
}
