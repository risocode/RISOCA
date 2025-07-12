
'use client';

import {useState, useEffect} from 'react';
import Image from 'next/image';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import {verifyPassword} from '@/app/actions/auth.actions';
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
import {KeyRound, Loader2, Fingerprint, AlertTriangle} from 'lucide-react';
import {usePasskey} from '@/hooks/use-passkey';

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

  const {
    isPasskeyLoading,
    isPasskeySupported,
    hasRegisteredPasskey,
    registerNewPasskey,
    loginWithPasskey,
  } = usePasskey({
    onLoginSuccess: () => {
      setAuthStep(AuthStep.Authenticated);
      toast({variant: 'success', title: 'Passkey Login Successful'});
    },
    onLoginError: (error: string) => {
      toast({variant: 'destructive', title: 'Passkey Login Failed', description: error});
    },
    onRegisterSuccess: () => {
      toast({
        variant: 'success',
        title: 'Passkey Registered',
        description: 'You can now use your fingerprint to log in.',
      });
    },
    onRegisterError: (error: string) => {
      toast({variant: 'destructive', title: 'Registration Failed', description: error});
    },
  });

  const form = useForm<PasswordFormData>({
    resolver: zodResolver(PasswordSchema),
    defaultValues: {password: ''},
  });
  
  // Try to log in with passkey automatically when component mounts
  useEffect(() => {
    if (hasRegisteredPasskey) {
      loginWithPasskey();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRegisteredPasskey]);

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
  
  const handleRegisterFromPrompt = async () => {
    const shouldRegister = window.confirm(
      'No passkey found for this site. Would you like to register this device for fingerprint login?'
    );
    if (shouldRegister) {
      await registerNewPasskey();
    }
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
        {isPasskeySupported && hasRegisteredPasskey && (
           <CardFooter className="flex-col gap-2 pt-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={loginWithPasskey}
              disabled={isPasskeyLoading}
            >
              {isPasskeyLoading ? (
                <Loader2 className="mr-2 animate-spin" />
              ) : (
                <Fingerprint className="mr-2" />
              )}
              {isPasskeyLoading ? 'Verifying...' : 'Login with Passkey'}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );

  if (authStep === AuthStep.Login) {
    return renderLoginScreen();
  }

  if (authStep === AuthStep.Authenticated) {
    return (
        <>
            {children}
            {isPasskeySupported && !hasRegisteredPasskey && (
                 <div className="fixed bottom-24 right-4 z-50 animate-enter sm:bottom-6">
                    <Card className="flex items-center gap-3 p-3 shadow-2xl">
                        <div className="flex-shrink-0 bg-primary/10 text-primary p-2 rounded-lg">
                            <Fingerprint className="h-6 w-6"/>
                        </div>
                        <div className="flex-grow pr-2">
                            <p className="font-semibold">Enable Passkey Login</p>
                            <p className="text-sm text-muted-foreground">Log in faster with your fingerprint.</p>
                        </div>
                        <Button onClick={registerNewPasskey} size="sm" disabled={isPasskeyLoading}>
                            {isPasskeyLoading ? <Loader2 className="animate-spin" /> : 'Register'}
                        </Button>
                    </Card>
                </div>
            )}
        </>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );
}
