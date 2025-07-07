'use client';

import {useState, useEffect} from 'react';
import Image from 'next/image';
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
      <div className="flex items-center justify-center bg-white">
        <Loader2 className="h-12 w-12 animate-spin text-black" />
        <p className="ml-4 text-black">Loading Receipt...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center bg-white text-red-600 font-bold">
        {error}
      </div>
    );
  }

  if (!transaction) {
    return null;
  }

  const receiptDate = transaction.createdAt.toDate();

  return (
    <div className="printable-receipt bg-white text-black font-mono text-xs max-w-xs mx-auto p-4">
      <header className="text-center mb-4 space-y-2">
        <div className="flex items-center justify-center gap-1">
          <Image
            src="/logo.png?v=7"
            alt="App Logo"
            width={32}
            height={32}
            priority
            className="w-auto h-8"
          />
          <Image
            src="/risoca.png"
            alt="RiSoCa Logo Text"
            width={96}
            height={29}
            priority
            className="w-auto h-7"
          />
        </div>
        <p className="text-xs">228 Divisoria Enrile Cagayan</p>
      </header>

      <div className="border-t border-b border-dashed border-black py-1 text-xs flex justify-between">
        <span>Date: {format(receiptDate, 'MM/dd/yyyy')}</span>
        <span>Time: {format(receiptDate, 'hh:mm a')}</span>
      </div>

      <div className="my-2 text-xs">
        <p>Receipt #: {transaction.id.substring(0, 8).toUpperCase()}</p>
        {transaction.customerName && (
          <p>Customer: {transaction.customerName}</p>
        )}
      </div>

      <div className="border-t border-dashed border-black">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-dashed border-black">
              <th className="text-left py-1 font-semibold">Item</th>
              <th className="text-center font-semibold">Qty</th>
              <th className="text-right font-semibold">Price</th>
              <th className="text-right py-1 font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {transaction.items.map((item, index) => (
              <tr key={index}>
                <td className="py-0.5 pr-1">{item.itemName}</td>
                <td className="text-center px-1">{item.quantity}</td>
                <td className="text-right px-1">{item.unitPrice.toFixed(2)}</td>
                <td className="text-right py-0.5 pl-1">
                  {item.total.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 pt-2 border-t border-black flex justify-between font-semibold">
        <span className="text-base">Total:</span>
        <span className="text-base">{formatCurrency(transaction.total)}</span>
      </div>

      <footer className="text-center mt-6 text-xs">
        <p>Thank you for your business!</p>
      </footer>
    </div>
  );
}
