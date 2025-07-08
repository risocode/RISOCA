
'use client';

import {useState, useEffect, useMemo} from 'react';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import {collection, query, onSnapshot, orderBy} from 'firebase/firestore';
import {db} from '@/lib/firebase';
import {startDay, closeDay} from '@/app/actions';
import type {WalletEntry} from '@/lib/schemas';
import {format, parseISO} from 'date-fns';

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
import {useToast} from '@/hooks/use-toast';
import {Loader2, Wallet, History, FileWarning} from 'lucide-react';
import {Skeleton} from '@/components/ui/skeleton';
import {Badge} from '@/components/ui/badge';
import {cn} from '@/lib/utils';

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

export default function WalletPage() {
  const [walletHistory, setWalletHistory] = useState<WalletEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {toast} = useToast();

  const startDayForm = useForm<StartDayFormData>({
    resolver: zodResolver(StartDaySchema),
    defaultValues: {startingCash: 0},
  });

  const endDayForm = useForm<EndDayFormData>({
    resolver: zodResolver(EndDaySchema),
    defaultValues: {endingCash: 0},
  });

  useEffect(() => {
    const q = query(
      collection(db, 'walletHistory'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const history = snapshot.docs.map(
          (doc) => ({id: doc.id, ...doc.data()} as WalletEntry)
        );
        setWalletHistory(history);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching wallet history:', error);
        toast({
          variant: 'destructive',
          title: 'Database Error',
          description: 'Could not fetch wallet history.',
        });
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [toast]);

  const openDay = useMemo(() => {
    return walletHistory.find((entry) => entry.status === 'open');
  }, [walletHistory]);

  const handleStartDay = async (data: StartDayFormData) => {
    setIsSubmitting(true);
    const response = await startDay(data.startingCash);
    if (response.success) {
      toast({
        variant: 'success',
        title: 'Day Started!',
        description: 'Your cash wallet for today is now open.',
      });
      startDayForm.reset();
    } else {
      toast({
        variant: 'destructive',
        title: 'Action Failed',
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
        title: 'Day Closed!',
        description: 'Your cash wallet for today is now closed.',
      });
      endDayForm.reset();
    } else {
      toast({
        variant: 'destructive',
        title: 'Action Failed',
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

  const renderCurrentDayCard = () => {
    if (isLoading) {
      return <Skeleton className="h-64 w-full" />;
    }

    if (openDay) {
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
                <FormField
                  control={endDayForm.control}
                  name="endingCash"
                  render={({field}) => (
                    <FormItem>
                      <FormLabel>Ending Cash</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Enter final cash amount"
                          {...field}
                        />
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
                  Close Day
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      );
    }

    return (
      <Card className="shadow-lg animate-enter">
        <CardHeader>
          <CardTitle>Start Your Day</CardTitle>
          <CardDescription>
            Enter your starting cash to open the wallet for today.
          </CardDescription>
        </CardHeader>
        <Form {...startDayForm}>
          <form onSubmit={startDayForm.handleSubmit(handleStartDay)}>
            <CardContent>
              <FormField
                control={startDayForm.control}
                name="startingCash"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Starting Cash</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Enter starting cash amount"
                        {...field}
                      />
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
                Start Day
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    );
  };

  return (
    <div className="flex flex-1 flex-col p-4 md:p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet /> Daily Wallet
        </h1>
      </header>

      {renderCurrentDayCard()}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History /> History
          </CardTitle>
          <CardDescription>
            A log of your previous daily wallet sessions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Start</TableHead>
                <TableHead className="text-right">End</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({length: 3}).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-16" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-5 w-20 ml-auto" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-5 w-20 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : walletHistory.length > 0 ? (
                walletHistory.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {format(parseISO(entry.date), 'MMMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          entry.status === 'open' ? 'default' : 'secondary'
                        }
                      >
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(entry.startingCash)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-mono',
                        entry.status === 'open' && 'text-muted-foreground'
                      )}
                    >
                      {formatCurrency(entry.endingCash)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
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
