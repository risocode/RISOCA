
'use client';

import * as React from 'react';
import {useState, useEffect, useMemo} from 'react';
import {useForm, useWatch} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import {db} from '@/lib/firebase';
import {startDay, closeDay} from '@/app/actions';
import type {
  WalletEntry,
  SaleTransaction,
  DiagnoseReceiptOutput,
} from '@/lib/schemas';
import {format, parseISO, isSameDay, startOfToday} from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Separator} from '@/components/ui/separator';
import {useToast} from '@/hooks/use-toast';
import {
  Loader2,
  Wallet,
  History,
  FileWarning,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import {Skeleton} from '@/components/ui/skeleton';
import {Badge} from '@/components/ui/badge';
import {cn} from '@/lib/utils';
import {
  ChartTooltipContent,
  ChartContainer,
} from '@/components/ui/chart';

type ReceiptDoc = DiagnoseReceiptOutput & {
  id: string;
  createdAt: Timestamp;
};

const StartDaySchema = z.object({
  startingCash: z.coerce
    .number()
    .min(0, 'Starting cash must be a positive number.'),
});
type StartDayFormData = z.infer<typeof StartDaySchema>;

const EndDaySchema = z.object({
  endingCash: z.coerce
    .number()
    .min(0, 'Ending cash must be a positive number.'),
});
type EndDayFormData = z.infer<typeof EndDaySchema>;

const denominations = [
  {value: 1000, label: '₱1,000 bill'},
  {value: 500, label: '₱500 bill'},
  {value: 200, label: '₱200 bill'},
  {value: 100, label: '₱100 bill'},
  {value: 50, label: '₱50 bill'},
  {value: 20, label: '₱20 bill'},
];

export default function WalletPage() {
  const [walletHistory, setWalletHistory] = useState<WalletEntry[]>([]);
  const [sales, setSales] = useState<SaleTransaction[]>([]);
  const [receipts, setReceipts] = useState<ReceiptDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [endCounts, setEndCounts] = useState<Record<string, string>>({});
  const {toast} = useToast();

  const startDayForm = useForm<StartDayFormData>({
    resolver: zodResolver(StartDaySchema),
    defaultValues: {startingCash: 0},
  });

  const endDayForm = useForm<EndDayFormData>({
    resolver: zodResolver(EndDaySchema),
    defaultValues: {endingCash: 0},
  });

  const watchedStartingCash = useWatch({
    control: startDayForm.control,
    name: 'startingCash',
  });

  const startDayTotal = useMemo(() => {
    return denominations.reduce((acc, denom) => {
      const count = Number(counts[String(denom.value)]) || 0;
      return acc + count * denom.value;
    }, 0);
  }, [counts]);

  const endDayTotal = useMemo(() => {
    return denominations.reduce((acc, denom) => {
      const count = Number(endCounts[String(denom.value)]) || 0;
      return acc + count * denom.value;
    }, 0);
  }, [endCounts]);

  useEffect(() => {
    startDayForm.setValue('startingCash', startDayTotal);
  }, [startDayTotal, startDayForm]);

  useEffect(() => {
    endDayForm.setValue('endingCash', endDayTotal);
  }, [endDayTotal, endDayForm]);

  const handleCountChange = (denomValue: number, countStr: string) => {
    setCounts((prev) => ({
      ...prev,
      [String(denomValue)]: countStr,
    }));
  };

  const handleEndCountChange = (denomValue: number, countStr: string) => {
    setEndCounts((prev) => ({
      ...prev,
      [String(denomValue)]: countStr,
    }));
  };

  useEffect(() => {
    const queries = [
      {
        collectionName: 'walletHistory',
        setter: setWalletHistory,
        q: query(collection(db, 'walletHistory'), orderBy('date', 'desc')),
      },
      {
        collectionName: 'saleTransactions',
        setter: setSales,
        q: query(
          collection(db, 'saleTransactions'),
          orderBy('createdAt', 'desc')
        ),
      },
      {
        collectionName: 'receipts',
        setter: setReceipts,
        q: query(collection(db, 'receipts'), orderBy('createdAt', 'desc')),
      },
    ];

    let pending = queries.length;
    const unsubs = queries.map(({collectionName, q, setter}) =>
      onSnapshot(
        q,
        (snapshot) => {
          setter(
            snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()} as any))
          );
          pending--;
          if (pending === 0) setIsLoading(false);
        },
        (error) => {
          console.error(`Error fetching ${collectionName}:`, error);
          toast({
            variant: 'destructive',
            title: 'Database Error',
            description: `Could not fetch ${collectionName}.`,
          });
          pending--;
          if (pending === 0) setIsLoading(false);
        }
      )
    );

    return () => unsubs.forEach((unsub) => unsub());
  }, [toast]);

  const {enrichedHistory, openDay, todayClosed, latestClosedDay} = useMemo(() => {
    const today = startOfToday();
    const openDayEntry = walletHistory.find((entry) => entry.status === 'open');
    const todayClosedEntry = walletHistory.find(
      (entry) =>
        isSameDay(parseISO(entry.date), today) && entry.status === 'closed'
    );
    const latestClosedDayEntry = walletHistory.find(
      (entry) => entry.status === 'closed'
    );

    const enriched = walletHistory.map((entry) => {
      const entryDate = parseISO(entry.date);
      const dailySales = sales
        .filter(
          (s) =>
            s.status !== 'voided' && isSameDay(s.createdAt.toDate(), entryDate)
        )
        .reduce((sum, s) => sum + s.total, 0);

      const dailyExpenses = receipts
        .filter((r) => isSameDay(r.createdAt.toDate(), entryDate))
        .reduce((sum, r) => sum + r.total, 0);

      let profit: number | null = null;
      if (entry.status === 'closed') {
        const endCash = entry.endingCash ?? 0;
        const startCash = entry.startingCash ?? 0;
        profit = endCash - startCash;
      }

      return {...entry, dailySales, dailyExpenses, profit};
    });

    return {
      enrichedHistory: enriched,
      openDay: openDayEntry,
      todayClosed: todayClosedEntry,
      latestClosedDay: latestClosedDayEntry,
    };
  }, [walletHistory, sales, receipts]);

  const totalProfit = useMemo(() => {
    return enrichedHistory
      .filter((e) => e.status === 'closed' && e.profit !== null)
      .reduce((acc, e) => acc + (e.profit!), 0);
  }, [enrichedHistory]);


  const handleStartDay = async (data: StartDayFormData) => {
    setIsSubmitting(true);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const response = await startDay(data.startingCash, todayStr);
    if (response.success) {
      toast({
        variant: 'success',
        title: 'Day Started',
      });
      startDayForm.reset();
      setCounts({});
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: response.message,
      });
    }
    setIsSubmitting(false);
  };

  const handleCloseDay = async (data: EndDayFormData) => {
    if (!openDay) return;
    setIsSubmitting(true);
    const response = await closeDay(openDay.id, data.endingCash);
    if (response.success) {
      toast({
        variant: 'success',
        title: 'Day Closed',
      });
      endDayForm.reset();
      setEndCounts({});
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: response.message,
      });
    }
    setIsSubmitting(false);
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';
    return `₱${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const chartData = enrichedHistory
    .filter((e) => e.status === 'closed')
    .slice(0, 7)
    .reverse();

  const CustomLegend = (props: any) => {
    const profitExists = chartData.some((d) => (d.profit || 0) >= 0);
    const lossExists = chartData.some((d) => (d.profit || 0) < 0);
  
    return (
      <div className="flex items-center justify-center gap-4 pt-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div
            className="h-2 w-2 shrink-0 rounded-[2px]"
            style={{backgroundColor: 'hsl(var(--muted-foreground))'}}
          />
          <span>Start</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="h-2 w-2 shrink-0 rounded-[2px]"
            style={{backgroundColor: 'hsl(var(--primary))'}}
          />
          <span>End</span>
        </div>
        {profitExists && (
          <div className="flex items-center gap-1.5">
            <div
              className="h-2 w-2 shrink-0 rounded-[2px]"
              style={{backgroundColor: 'hsl(var(--success))'}}
            />
            <span>Profit</span>
          </div>
        )}
        {lossExists && (
          <div className="flex items-center gap-1.5">
            <div
              className="h-2 w-2 shrink-0 rounded-[2px]"
              style={{backgroundColor: 'hsl(var(--destructive))'}}
            />
            <span>Loss</span>
          </div>
        )}
      </div>
    );
  };

  const CustomTooltip = (props: any) => {
    const {active, payload, label} = props;

    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const newPayload = payload.map((p: any) => {
        if (p.dataKey === 'profit') {
          return {
            ...p,
            name: data.profit >= 0 ? 'Profit' : 'Loss',
            color:
              data.profit >= 0
                ? 'hsl(var(--success))'
                : 'hsl(var(--destructive))',
          };
        }
        return p;
      });
      return (
        <ChartTooltipContent
          {...props}
          payload={newPayload}
          formatter={formatCurrency}
        />
      );
    }

    return null;
  };

  const renderCurrentDayCard = () => {
    if (openDay) {
      const openDayData = enrichedHistory.find((e) => e.id === openDay.id);
      const {dailySales, dailyExpenses} = openDayData || {dailySales:0, dailyExpenses:0};
      return (
        <Card className="shadow-lg animate-enter">
          <CardHeader>
            <CardTitle>Day in Progress</CardTitle>
            <CardDescription>
              Today is {format(new Date(), 'MMMM d, yyyy')}.
            </CardDescription>
          </CardHeader>
          <Form {...endDayForm}>
            <form onSubmit={endDayForm.handleSubmit(handleCloseDay)}>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-4 rounded-lg bg-muted">
                  <span className="text-muted-foreground">Starting Cash</span>
                  <span className="font-bold text-lg">
                    {formatCurrency(openDay.startingCash)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Sales Today</p>
                    <p className="font-bold text-lg text-primary">
                      {formatCurrency(dailySales)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Expenses Today</p>
                    <p className="font-bold text-lg text-destructive">
                      {formatCurrency(dailyExpenses)}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Ending Cash Breakdown</Label>
                  <div className="grid grid-cols-[1fr_80px_1fr] items-center gap-x-4 gap-y-2 text-sm">
                    <Label className="font-semibold text-muted-foreground">
                      Denomination
                    </Label>
                    <Label className="text-center font-semibold text-muted-foreground">
                      Qty
                    </Label>
                    <Label className="text-right font-semibold text-muted-foreground">
                      Total
                    </Label>
                    {denominations.map((denom) => (
                      <React.Fragment key={denom.value}>
                        <Label
                          htmlFor={`end-denom-${denom.value}`}
                          className="text-muted-foreground"
                        >
                          {denom.label}
                        </Label>
                        <Input
                          id={`end-denom-${denom.value}`}
                          type="number"
                          min="0"
                          className="h-8 text-center"
                          placeholder="0"
                          onChange={(e) =>
                            handleEndCountChange(denom.value, e.target.value)
                          }
                          value={endCounts[String(denom.value)] || ''}
                        />
                        <p className="text-right font-mono text-foreground">
                          {formatCurrency(
                            (Number(endCounts[String(denom.value)]) || 0) *
                              denom.value
                          )}
                        </p>
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between items-baseline text-xl font-bold">
                  <span className="text-foreground">Total Ending Cash</span>
                  <span className="font-mono text-primary">
                    {formatCurrency(endDayTotal)}
                  </span>
                </div>

                <FormField
                  control={endDayForm.control}
                  name="endingCash"
                  render={({field}) => (
                    <FormItem className="!hidden">
                      <FormControl>
                        <Input {...field} readOnly />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting && <Loader2 className="mr-2 animate-spin" />}
                  Close Day with {formatCurrency(endDayTotal)}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      );
    }

    if (todayClosed) {
      return (
         <Card className="shadow-lg animate-enter">
          <CardHeader>
            <CardTitle>Day Complete</CardTitle>
            <CardDescription>
              The session for today, {format(new Date(), 'MMMM d, yyyy')}, has already been closed.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center p-10 text-center">
             <p className="text-muted-foreground">Please come back tomorrow to start a new session.</p>
          </CardContent>
         </Card>
      );
    }

    return (
      <Card className="shadow-lg animate-enter">
        <CardHeader>
          <CardTitle>Start Your Day</CardTitle>
          <CardDescription>
            Count your starting cash to open the wallet for today.
          </CardDescription>
        </CardHeader>
        <Form {...startDayForm}>
          <form onSubmit={startDayForm.handleSubmit(handleStartDay)}>
            <CardContent className="space-y-4">
              {latestClosedDay?.endingCash !== undefined && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <p className="text-sm">
                    Last closing balance:{' '}
                    <span className="font-bold font-mono">
                      {formatCurrency(latestClosedDay.endingCash)}
                    </span>
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      startDayForm.setValue(
                        'startingCash',
                        latestClosedDay.endingCash || 0
                      );
                      setCounts({});
                      toast({
                        title: 'Amount Set',
                        description: `Starting cash set to ${formatCurrency(
                          latestClosedDay.endingCash
                        )}.`,
                      });
                    }}
                  >
                    Use this amount
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-[1fr_80px_1fr] items-center gap-x-4 gap-y-2 text-sm">
                <Label className="font-semibold text-muted-foreground">
                  Denomination
                </Label>
                <Label className="text-center font-semibold text-muted-foreground">
                  Qty
                </Label>
                <Label className="text-right font-semibold text-muted-foreground">
                  Total
                </Label>

                {denominations.map((denom) => (
                  <React.Fragment key={denom.value}>
                    <Label
                      htmlFor={`denom-${denom.value}`}
                      className="text-muted-foreground"
                    >
                      {denom.label}
                    </Label>
                    <Input
                      id={`denom-${denom.value}`}
                      type="number"
                      min="0"
                      className="h-8 text-center"
                      placeholder="0"
                      onChange={(e) =>
                        handleCountChange(denom.value, e.target.value)
                      }
                      value={counts[String(denom.value)] || ''}
                    />
                    <p className="text-right font-mono text-foreground">
                      {formatCurrency(
                        (Number(counts[String(denom.value)]) || 0) * denom.value
                      )}
                    </p>
                  </React.Fragment>
                ))}
              </div>

              <Separator />

              <div className="flex justify-between items-baseline text-xl font-bold">
                <span className="text-foreground">Total Starting Cash</span>
                <span className="font-mono text-primary">
                  {formatCurrency(watchedStartingCash)}
                </span>
              </div>
              <FormField
                control={startDayForm.control}
                name="startingCash"
                render={({field}) => (
                  <FormItem className="!hidden">
                    <FormControl>
                      <Input {...field} readOnly />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting && <Loader2 className="mr-2 animate-spin" />}
                Start Day with {formatCurrency(watchedStartingCash)}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col p-4 md:p-6 space-y-6">
        <header>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet /> Daily Wallet
          </h1>
        </header>
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-4 md:p-6 space-y-6 opacity-0 animate-page-enter">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet /> Daily Wallet
        </h1>
      </header>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2">
            <Wallet className="w-6 h-6" /> Overall Wallet Profit
          </CardTitle>
          <CardDescription className="text-center">
            This is the total profit from all closed days, calculated as (Ending Cash - Starting Cash).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div
            className={cn(
              'text-5xl font-bold tracking-tighter flex items-center justify-center gap-2',
              totalProfit >= 0 ? 'text-success' : 'text-destructive'
            )}
          >
            {totalProfit >= 0 ? (
              <TrendingUp className="h-10 w-10" />
            ) : (
              <TrendingDown className="h-10 w-10" />
            )}
            {formatCurrency(totalProfit)}
          </div>
        </CardContent>
      </Card>

      {renderCurrentDayCard()}

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Overview</CardTitle>
            <CardDescription>Last 7 closed days.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-64 w-full">
              <BarChart
                data={chartData}
                margin={{top: 5, right: 20, left: -10, bottom: 5}}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => format(parseISO(value), 'MMM d')}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `₱${value / 1000}k`}
                />
                <Tooltip cursor={{fill: 'hsl(var(--muted))'}} content={<CustomTooltip />} />
                <Legend content={<CustomLegend />} />
                <Bar
                  dataKey="startingCash"
                  name="Start"
                  fill="hsl(var(--muted-foreground))"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="endingCash"
                  name="End"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
                <Bar dataKey="profit" name="Profit" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        (entry.profit || 0) >= 0
                          ? 'hsl(var(--success))'
                          : 'hsl(var(--destructive))'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History /> Detailed History
          </CardTitle>
          <CardDescription>
            A log of your previous daily wallet sessions and performance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">Date</TableHead>
                <TableHead className="text-center">Start</TableHead>
                <TableHead className="text-center">Sales</TableHead>
                <TableHead className="text-center">Expenses</TableHead>
                <TableHead className="text-center">Profit</TableHead>
                <TableHead className="text-center">End</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrichedHistory.length > 0 ? (
                enrichedHistory.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-center font-medium">
                      {format(parseISO(entry.date), 'MMMM d, yyyy')}
                      <Badge
                        variant={
                          entry.status === 'open' ? 'default' : 'secondary'
                        }
                        className="ml-2"
                      >
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {formatCurrency(entry.startingCash)}
                    </TableCell>
                    <TableCell className="text-center font-mono text-primary">
                      {formatCurrency(entry.dailySales)}
                    </TableCell>
                    <TableCell className="text-center font-mono text-destructive">
                      {formatCurrency(entry.dailyExpenses)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-center font-mono',
                        entry.profit == null ? '' : (entry.profit >= 0 ? 'text-success' : 'text-destructive')
                      )}
                    >
                      <div className="flex items-center justify-center">
                        {entry.profit != null && (entry.profit >= 0 ? (
                          <TrendingUp className="mr-1" />
                        ) : (
                          <TrendingDown className="mr-1" />
                        ))}
                        {formatCurrency(entry.profit)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {formatCurrency(entry.endingCash)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <FileWarning className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    No wallet history found. Start a day to begin.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
