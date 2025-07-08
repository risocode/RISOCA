'use client';

import React, {useState, useEffect, useMemo} from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  collection,
  query,
  onSnapshot,
  where,
  Timestamp,
} from 'firebase/firestore';
import {db} from '@/lib/firebase';
import {format, subDays, startOfDay, endOfDay, isSameDay} from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltipContent,
  ChartStyle,
} from '@/components/ui/chart';
import {Skeleton} from '@/components/ui/skeleton';
import type {SaleTransaction} from '@/lib/schemas';
import type {DiagnoseReceiptOutput} from '@/ai/flows/diagnose-receipt-flow';

type ReceiptDoc = DiagnoseReceiptOutput & {
  id: string;
  createdAt: Timestamp;
};

export function DailyPerformanceChart() {
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const today = new Date();
    const startDate = startOfDay(subDays(today, 6));

    const salesQuery = query(
      collection(db, 'saleTransactions'),
      where('createdAt', '>=', startDate)
    );
    const expensesQuery = query(
      collection(db, 'receipts'),
      where('createdAt', '>=', startDate)
    );

    let salesData: SaleTransaction[] = [];
    let receiptsData: ReceiptDoc[] = [];
    let loadedCount = 0;

    const processData = () => {
      if (loadedCount < 2) return;

      const dailyData = Array.from({length: 7}).map((_, i) => {
        const date = subDays(today, i);
        return {
          date: format(date, 'MMM d'),
          fullDate: date,
          sales: 0,
          expenses: 0,
        };
      });

      salesData.forEach((sale) => {
        if (sale.status !== 'voided') {
          const day = dailyData.find((d) =>
            isSameDay(d.fullDate, sale.createdAt.toDate())
          );
          if (day) day.sales += sale.total;
        }
      });

      receiptsData.forEach((receipt) => {
        const day = dailyData.find((d) =>
          isSameDay(d.fullDate, receipt.createdAt.toDate())
        );
        if (day) day.expenses += receipt.total;
      });

      setChartData(dailyData.reverse());
      setIsLoading(false);
    };

    const unsubSales = onSnapshot(salesQuery, (snapshot) => {
      salesData = snapshot.docs.map(
        (doc) => ({id: doc.id, ...doc.data()} as SaleTransaction)
      );
      if (loadedCount < 2) loadedCount++;
      processData();
    });

    const unsubExpenses = onSnapshot(expensesQuery, (snapshot) => {
      receiptsData = snapshot.docs.map(
        (doc) => ({id: doc.id, ...doc.data()} as ReceiptDoc)
      );
      if (loadedCount < 2) loadedCount++;
      processData();
    });

    return () => {
      unsubSales();
      unsubExpenses();
    };
  }, []);

  const chartConfig = {
    sales: {
      label: 'Sales',
      color: 'hsl(var(--primary))',
    },
    expenses: {
      label: 'Expenses',
      color: 'hsl(var(--accent))',
    },
  };

  const formatCurrency = (value: number) =>
    `₱${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-7 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-60 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Performance</CardTitle>
        <CardDescription>
          Sales vs. Expenses for the Last 7 Days
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-60 w-full">
          <BarChart data={chartData} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent formatter={formatCurrency} />}
            />
            <Legend />
            <Bar
              dataKey="sales"
              fill="var(--color-sales)"
              radius={4}
              name="Sales"
            />
            <Bar
              dataKey="expenses"
              fill="var(--color-expenses)"
              radius={4}
              name="Expenses"
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
