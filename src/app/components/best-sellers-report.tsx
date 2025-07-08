'use client';

import React, {useState, useEffect} from 'react';
import {
  collection,
  query,
  onSnapshot,
  where,
} from 'firebase/firestore';
import {db} from '@/lib/firebase';
import type {SaleTransaction, SaleItem} from '@/lib/schemas';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {Skeleton} from '@/components/ui/skeleton';
import {Loader2, Star, Trophy, FileWarning} from 'lucide-react';

interface BestSellerItem {
  itemId: string;
  itemName: string;
  quantitySold: number;
  totalRevenue: number;
}

export function BestSellersReport() {
  const [reportData, setReportData] = useState<BestSellerItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (!isDialogOpen) {
      return;
    }
    
    setIsLoading(true);
    const salesQuery = query(
        collection(db, 'saleTransactions'),
        where('status', '!=', 'voided')
    );

    const unsubscribe = onSnapshot(salesQuery, (snapshot) => {
        const itemMap = new Map<string, BestSellerItem>();
        
        snapshot.docs.forEach((doc) => {
            const transaction = doc.data() as SaleTransaction;
            transaction.items.forEach((item: SaleItem) => {
                const key = item.itemId || item.itemName; // Use itemId if available, otherwise itemName
                const existingItem = itemMap.get(key);

                if (existingItem) {
                    existingItem.quantitySold += item.quantity;
                    existingItem.totalRevenue += item.total;
                } else {
                    itemMap.set(key, {
                        itemId: key,
                        itemName: item.itemName,
                        quantitySold: item.quantity,
                        totalRevenue: item.total,
                    });
                }
            });
        });

        const aggregatedData = Array.from(itemMap.values());
        aggregatedData.sort((a, b) => b.quantitySold - a.quantitySold);
        
        setReportData(aggregatedData.slice(0, 5));
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching sales data: ", error);
        setIsLoading(false);
    });

    return () => unsubscribe();

  }, [isDialogOpen]);

  const formatCurrency = (value: number) =>
    `₱${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full">
          <Trophy className="mr-2" />
          View Top 5 Products
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy /> Best-Selling Products
          </DialogTitle>
          <DialogDescription>
            Your top 5 products ranked by quantity sold.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          {isLoading ? (
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">Rank</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-center">Sold</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({length: 5}).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-5 mx-auto rounded-full"/></TableCell>
                        <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-1/2 mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-1/2 ml-auto" /></TableCell>
                    </TableRow>
                ))}
              </TableBody>
             </Table>
          ) : reportData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">Rank</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-center">Sold</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.map((item, index) => (
                  <TableRow key={item.itemId}>
                    <TableCell className="text-center font-bold text-lg text-muted-foreground">
                       {index === 0 ? <Trophy className="mx-auto text-yellow-500"/> : index + 1}
                    </TableCell>
                    <TableCell className="font-medium">{item.itemName}</TableCell>
                    <TableCell className="text-center">{item.quantitySold}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(item.totalRevenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                <FileWarning className="w-10 h-10 mb-2 text-muted-foreground" />
                <p className="font-medium">No sales data available.</p>
                <p className="text-sm text-muted-foreground">Sell some products to see your best-sellers here.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
