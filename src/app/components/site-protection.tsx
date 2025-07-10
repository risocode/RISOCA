
'use client';

import {useState, useEffect} from 'react';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import {verifyPassword} from '@/app/actions';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {useToast} from '@/hooks/use-toast';
import {KeyRound, Loader2} from 'lucide-react';

const PasswordSchema = z.object({
  password: z.string().min(1, 'Password is required.'),
});

type PasswordFormData = z.infer<typeof PasswordSchema>;

export function SiteProtection({children}: {children: React.ReactNode}) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {toast} = useToast();

  const form = useForm<PasswordFormData>({
    resolver: zodResolver(PasswordSchema),
    defaultValues: {
      password: '',
    },
  });

  useEffect(() => {
    // Check session storage on initial load
    const storedAuth = sessionStorage.getItem('risoca-auth');
    if (storedAuth === 'true') {
      setIsAuthenticated(true);
    }
    setIsChecking(false);
  }, []);

  const handlePasswordSubmit = async (data: PasswordFormData) => {
    setIsSubmitting(true);
    const response = await verifyPassword(data.password);
    if (response.success) {
      sessionStorage.setItem('risoca-auth', 'true');
      setIsAuthenticated(true);
      toast({
        variant: 'success',
        title: 'Access Granted',
      });
    } else {
      form.setError('password', {
        type: 'manual',
        message: 'Incorrect password.',
      });
      toast({
        variant: 'destructive',
        title: 'Access Denied',
      });
    }
    setIsSubmitting(false);
  };

  if (isChecking) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm animate-enter">
        <CardHeader className="text-center">
          <KeyRound className="mx-auto h-12 w-12 text-primary" />
          <CardTitle className="!mt-4">Protected Area</CardTitle>
          <CardDescription>
            Please enter the password to access the application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handlePasswordSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="password"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting && <Loader2 className="mr-2 animate-spin" />}
                Unlock
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
