
'use client';

import {useState, useEffect, useCallback} from 'react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {useToast} from '@/hooks/use-toast';
import {KeyRound, Loader2, Fingerprint} from 'lucide-react';
import {usePasskey} from '@/hooks/use-passkey';

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
  const {toast} = useToast();
  const {
    hasPasskeys,
    isSupported,
    loginWithPasskey,
    registerNewPasskey,
    isLoading: isPasskeyLoading,
  } = usePasskey();
  
  const [showRegistrationPrompt, setShowRegistrationPrompt] = useState(false);

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
  
  const finishAuthentication = useCallback(() => {
      sessionStorage.setItem('risoca-auth', 'true');
      setAuthStep(AuthStep.Authenticated);
      setShowRegistrationPrompt(false);
      toast({variant: 'success', title: 'Login Successful'});
  }, [toast]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const handlePasswordSubmit = async (data: PasswordFormData) => {
    setIsSubmitting(true);
    const response = await verifyPassword(data.password);
    if (response.success) {
      if (isSupported && !hasPasskeys) {
        setShowRegistrationPrompt(true);
      } else {
        finishAuthentication();
      }
    } else {
      form.setError('password', {
        type: 'manual',
        message: 'Incorrect password.',
      });
      toast({variant: 'destructive', title: 'Access Denied'});
    }
    setIsSubmitting(false);
  };

  const handlePasskeyLogin = async () => {
    const {success, error} = await loginWithPasskey();
    if (success) {
      finishAuthentication();
    } else {
      toast({variant: 'destructive', title: 'Login Failed', description: error});
    }
  };

  const handleRegisterFromPrompt = async () => {
    const {success, error} = await registerNewPasskey();
    if (success) {
      toast({
        variant: 'success',
        title: 'Device Registered',
        description: 'You can now use this device to log in.',
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Registration Failed',
        description: error,
      });
    }
    finishAuthentication();
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
              <div className="flex flex-col gap-2">
                <Button
                  type="submit"
                  disabled={isSubmitting || isPasskeyLoading}
                  className="w-full"
                >
                  {(isSubmitting || isPasskeyLoading) && (
                    <Loader2 className="mr-2 animate-spin" />
                  )}
                  Unlock
                </Button>
                {isSupported && hasPasskeys && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handlePasskeyLogin}
                    disabled={isPasskeyLoading || isSubmitting}
                  >
                    {isPasskeyLoading ? (
                      <Loader2 className="mr-2 animate-spin" />
                    ) : (
                      <Fingerprint className="mr-2" />
                    )}
                    Login with Passkey
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
  
  const renderPasskeyPrompt = () => (
    <AlertDialog open={showRegistrationPrompt}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Enable Quick Login?</AlertDialogTitle>
          <AlertDialogDescription>
            Would you like to register this device to log in quickly and securely with its built-in security (e.g., fingerprint, face, or PIN)?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={finishAuthentication}>Not Now</AlertDialogCancel>
          <AlertDialogAction onClick={handleRegisterFromPrompt}>
            <Fingerprint className="mr-2 h-4 w-4" /> Register Device
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (authStep === AuthStep.Checking) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (authStep === AuthStep.Login) {
    return (
      <>
        {renderLoginScreen()}
        {renderPasskeyPrompt()}
      </>
    );
  }

  if (authStep === AuthStep.Authenticated) {
    return <>{children}</>;
  }

  return null;
}
