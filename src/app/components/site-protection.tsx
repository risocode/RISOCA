
'use client';

import {useState, useEffect, useCallback} from 'react';
import Image from 'next/image';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import {
  verifyPassword,
  getAuthenticationOptions,
  verifyExistingAuthentication,
  getAuthenticators,
} from '@/app/actions';
import {startAuthentication} from '@simplewebauthn/browser';
import type {Authenticator} from '@/lib/schemas';
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
import {
  KeyRound,
  Loader2,
  Fingerprint,
} from 'lucide-react';

const PasswordSchema = z.object({
  password: z.string().min(1, 'Password is required.'),
});

type PasswordFormData = z.infer<typeof PasswordSchema>;

enum AuthStep {
  Checking,
  Login,
  Authenticated,
}

export function SiteProtection({children}: {children: React.ReactNode}) {
  const [authStep, setAuthStep] = useState<AuthStep>(AuthStep.Checking);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasPasskeys, setHasPasskeys] = useState(false);
  const {toast} = useToast();

  const form = useForm<PasswordFormData>({
    resolver: zodResolver(PasswordSchema),
    defaultValues: {password: ''},
  });

  const checkSession = useCallback(() => {
    const isAuthenticated = sessionStorage.getItem('risoca-auth') === 'true';
    if (isAuthenticated) {
      setAuthStep(AuthStep.Authenticated);
    } else {
      setAuthStep(AuthStep.Login);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);
  
  // Check for available passkeys when the login form is shown
  useEffect(() => {
    if (authStep === AuthStep.Login) {
        const checkPasskeys = async () => {
            try {
                const existing = await getAuthenticators();
                setHasPasskeys(existing.length > 0);
            } catch (error) {
                console.error("Could not check for passkeys:", error);
                setHasPasskeys(false);
            }
        };
        checkPasskeys();
    }
  }, [authStep]);


  const handlePasswordSubmit = async (data: PasswordFormData) => {
    setIsSubmitting(true);
    const response = await verifyPassword(data.password);
    if (response.success) {
      sessionStorage.setItem('risoca-auth', 'true');
      setAuthStep(AuthStep.Authenticated);
      toast({variant: 'success', title: 'Login Successful'});
    } else {
      form.setError('password', {
        type: 'manual',
        message: 'Incorrect password.',
      });
      toast({variant: 'destructive', title: 'Access Denied'});
    }
    setIsSubmitting(false);
  };
  
  const handleAuthenticate = async () => {
    setIsSubmitting(true);
    try {
      const options = await getAuthenticationOptions();
      if (options.allowCredentials?.length === 0) {
        toast({
          variant: 'destructive',
          title: 'No Passkeys Registered',
          description:
            'Please log in with your password to register a Passkey.',
        });
        setIsSubmitting(false);
        return;
      }
      const response = await startAuthentication(options);
      const {verified} = await verifyExistingAuthentication(response);

      if (verified) {
        sessionStorage.setItem('risoca-auth', 'true');
        setAuthStep(AuthStep.Authenticated);
        toast({variant: 'success', title: 'Login Successful'});
      } else {
        throw new Error('Authentication failed.');
      }
    } catch (error) {
      console.error(error);
      const errorMessage = (error as Error).message;
      if (!errorMessage.includes('cancelled')) {
        toast({
          variant: 'destructive',
          title: 'Login Failed',
          description: errorMessage,
        });
      }
    }
    setIsSubmitting(false);
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
            Please enter the password or use a Passkey to continue.
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
                {isSubmitting && form.formState.isSubmitting && <Loader2 className="mr-2 animate-spin" />}
                Unlock
              </Button>
            </form>
          </Form>
            {hasPasskeys && (
                <>
                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">
                            Or
                        </span>
                        </div>
                    </div>
                    <Button
                        onClick={handleAuthenticate}
                        disabled={isSubmitting}
                        variant="secondary"
                        className="w-full"
                    >
                        {isSubmitting && !form.formState.isSubmitting ? (
                        <Loader2 className="mr-2 animate-spin" />
                        ) : (
                        <Fingerprint className="mr-2" />
                        )}
                        Login with Passkey
                    </Button>
                </>
            )}
        </CardContent>
      </Card>
    </div>
  );

  if (authStep === AuthStep.Checking) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (authStep === AuthStep.Login) {
    return renderLoginScreen();
  }

  if (authStep === AuthStep.Authenticated) {
    return <>{children}</>;
  }

  return null;
}
