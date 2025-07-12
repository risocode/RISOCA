
'use client';

import {useState} from 'react';
import Image from 'next/image';
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
  CardFooter,
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

enum AuthStep {
  Login,
  Authenticated,
}

export function SiteProtection({children}: {children: React.ReactNode}) {
  const [authStep, setAuthStep] = useState<AuthStep>(AuthStep.Login);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const {toast} = useToast();

  const form = useForm<PasswordFormData>({
    resolver: zodResolver(PasswordSchema),
    defaultValues: {password: ''},
  });

  const handlePasswordSubmit = async (data: PasswordFormData) => {
    setIsSubmittingPassword(true);
    const response = await verifyPassword(data.password);
    if (response.success) {
      toast({variant: 'success', title: 'Login Successful'});
      setAuthStep(AuthStep.Authenticated);
    } else {
      form.setError('password', {
        type: 'manual',
        message: 'Incorrect password.',
      });
      toast({variant: 'destructive', title: 'Access Denied'});
    }
    setIsSubmittingPassword(false);
  };

  const renderLoginScreen = () => (
    <div className="flex h-full w-full items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm animate-enter">
        <CardHeader className="text-center items-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Image
              src="/logo.png?v=8"
              alt="App Logo"
              width={40}
              height={40}
              priority
              className="w-auto h-9"
            />
            <Image
              src="/risoca.png?v=8"
              alt="RiSoCa Logo Text"
              width={120}
              height={36}
              priority
              className="w-auto h-8"
            />
          </div>
          <KeyRound className="mx-auto h-12 w-12 text-primary" />
          <CardTitle className="!mt-4">Protected Area</CardTitle>
          <CardDescription>
            Please enter the password to continue.
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
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={isSubmittingPassword}
                className="w-full"
              >
                {isSubmittingPassword && (
                  <Loader2 className="mr-2 animate-spin" />
                )}
                Unlock
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );

  if (authStep === AuthStep.Login) {
    return renderLoginScreen();
  }

  if (authStep === AuthStep.Authenticated) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );
}
