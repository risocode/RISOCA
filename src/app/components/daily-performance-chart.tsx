
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
import {
  format,
  subDays,
  startOfDay,
  isSameDay,
  subMonths,
  startOfMonth,
  isSameMonth,
  subYears,
  startOfYear,
  isSameYear,
} from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {Skeleton} from '@/components/ui/skeleton';
import {Tabs, TabsList, TabsTrigger} from '@/components/ui/tabs';
import type {SaleTransaction} from '@/lib/schemas';
import type {DiagnoseReceiptOutput} from '@/ai/flows/diagnose-receipt-flow';

type ReceiptDoc = DiagnoseReceiptOutput & {
  id: string;
  createdAt: Timestamp;
};

type TimeRange = 'daily' | 'monthly' | 'yearly';

export function DailyPerformanceChart() {
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('daily');

  useEffect(() => {
    setIsLoading(true);
    const today = new Date();
    let startDate: Date;

    if (timeRange === 'daily') {
      startDate = startOfDay(subDays(today, 6));
    } else if (timeRange === 'monthly') {
      startDate = startOfMonth(subMonths(today, 11));
    } else {
      // yearly
      startDate = startOfYear(subYears(today, 4));
    }

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
      let processedData;

      if (timeRange === 'daily') {
        processedData = Array.from({length: 7}).map((_, i) => {
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
            const day = processedData.find((d) =>
              isSameDay(d.fullDate, sale.createdAt.toDate())
            );
            if (day) day.sales += sale.total;
          }
        });
        receiptsData.forEach((receipt) => {
          const day = processedData.find((d) =>
            isSameDay(d.fullDate, receipt.createdAt.toDate())
          );
          if (day) day.expenses += receipt.total;
        });
      } else if (timeRange === 'monthly') {
        processedData = Array.from({length: 12}).map((_, i) => {
          const date = subMonths(today, i);
          return {
            date: format(date, 'MMM'),
            fullDate: date,
            sales: 0,
            expenses: 0,
          };
        });
        salesData.forEach((sale) => {
          if (sale.status !== 'voided') {
            const month = processedData.find((d) =>
              isSameMonth(d.fullDate, sale.createdAt.toDate())
            );
            if (month) month.sales += sale.total;
          }
        });
        receiptsData.forEach((receipt) => {
          const month = processedData.find((d) =>
            isSameMonth(d.fullDate, receipt.createdAt.toDate())
          );
          if (month) month.expenses += receipt.total;
        });
      } else {
        // yearly
        processedData = Array.from({length: 5}).map((_, i) => {
          const date = subYears(today, i);
          return {
            date: format(date, 'yyyy'),
            fullDate: date,
            sales: 0,
            expenses: 0,
          };
        });
        salesData.forEach((sale) => {
          if (sale.status !== 'voided') {
            const year = processedData.find((d) =>
              isSameYear(d.fullDate, sale.createdAt.toDate())
            );
            if (year) year.sales += sale.total;
          }
        });
        receiptsData.forEach((receipt) => {
          const year = processedData.find((d) =>
            isSameYear(d.fullDate, receipt.createdAt.toDate())
          );
          if (year) year.expenses += receipt.total;
        });
      }
      setChartData(processedData.reverse());
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
  }, [timeRange]);

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

  const descriptionText = useMemo(() => {
    const today = new Date();
    switch (timeRange) {
      case 'daily':
        const startDate = subDays(today, 6);
        if (isSameMonth(startDate, today)) {
          return `Showing daily data for ${format(today, 'MMMM yyyy')}`;
        }
        return `Showing daily data: ${format(
          startDate,
          'MMM d'
        )} - ${format(today, 'MMM d, yyyy')}`;
      case 'monthly':
        return 'Showing data for the last 12 months';
      case 'yearly':
        return 'Showing data for the last 5 years';
    }
  }, [timeRange]);

  const CustomAxisTick = (props: any) => {
    const {x, y, payload} = props;
    const {value} = payload;

    if (timeRange === 'daily') {
      const parts = value.split(' ');
      if (parts.length === 2) {
        const [month, day] = parts;
        return (
          <g transform={`translate(${x},${y})`}>
            <text
              x={0}
              y={0}
              dy={12}
              textAnchor="middle"
              fill="hsl(var(--muted-foreground))"
              fontSize="12px"
            >
              {day}
            </text>
            <text
              x={0}
              y={12}
              dy={12}
              textAnchor="middle"
              fill="hsl(var(--muted-foreground))"
              fontSize="10px"
            >
              {month}
            </text>
          </g>
        );
      }
    }

    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          dy={16}
          textAnchor="middle"
          fill="hsl(var(--muted-foreground))"
          fontSize="12px"
        >
          {value}
        </text>
      </g>
    );
  };

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
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <CardTitle>Performance Overview</CardTitle>
            <CardDescription>{descriptionText}</CardDescription>
          </div>
          <Tabs
            value={timeRange}
            onValueChange={(value) => setTimeRange(value as TimeRange)}
            className="w-full sm:w-auto"
          >
            <TabsList className="grid w-full grid-cols-3 sm:w-auto">
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly">Yearly</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <BarChart data={chartData} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={<CustomAxisTick />}
              height={50}
              tickMargin={5}
            />
            <YAxis
              width={80}
              axisLine={false}
              tickLine={false}
              tickMargin={5}
              tickFormatter={(value) => `₱${value.toLocaleString('en-US')}`}
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
