'use client';

import Link from 'next/link';
import {useReceipts} from '@/contexts/ReceiptContext';
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
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {DollarSign, FileText, ScanLine, Tag} from 'lucide-react';

export default function DashboardPage() {
  const {receipts, totalSpent, categories} = useReceipts();

  const uniqueCategories = Object.keys(categories).length;

  if (receipts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <FileText className="w-16 h-16 mb-4 text-muted-foreground" />
        <h2 className="text-2xl font-semibold">No Receipts Scanned</h2>
        <p className="max-w-md mt-2 text-muted-foreground">
          You haven't scanned any receipts yet. Go to the scanner to upload your
          first one.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">
            <ScanLine className="mr-2" /> Go to Scanner
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="p-4 border-b">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          A summary of your scanned receipts.
        </p>
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${totalSpent.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                from {receipts.length} receipts
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                Receipts Scanned
              </CardTitle>
              <FileText className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{receipts.length}</div>
              <p className="text-xs text-muted-foreground">
                Keep them coming!
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                Unique Categories
              </CardTitle>
              <Tag className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{uniqueCategories}</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {Object.keys(categories).map((cat) => (
                  <Badge key={cat} variant="secondary">
                    {cat}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Receipt History</CardTitle>
            <CardDescription>
              A detailed list of all your scanned receipts for this session.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map((receipt) => (
                  <TableRow key={receipt.id}>
                    <TableCell className="font-medium">
                      {receipt.merchantName}
                    </TableCell>
                    <TableCell>
                      {new Date(
                        receipt.transactionDate + 'T00:00:00'
                      ).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{receipt.category}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${receipt.total.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
