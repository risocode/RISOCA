
'use client';

import {useState, useEffect, useCallback} from 'react';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import {
  verifyPassword,
  getAuthenticationOptions,
  verifyExistingAuthentication,
  getRegistrationOptions,
  verifyNewRegistration,
  getAuthenticators,
} from '@/app/actions';
import {
  startRegistration,
  startAuthentication,
} from '@simplewebauthn/browser';
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
  PlusCircle,
  Laptop,
  Smartphone,
} from 'lucide-react';

const PasswordSchema = z.object({
  password: z.string().min(1, 'Password is required.'),
});

type PasswordFormData = z.infer<typeof PasswordSchema>;

enum AuthStep {
  Checking,
  Password,
  Passkey,
  Authenticated,
}

export function SiteProtection({children}: {children: React.ReactNode}) {
  const [authStep, setAuthStep] = useState<AuthStep>(AuthStep.Checking);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authenticators, setAuthenticators] = useState<Authenticator[]>([]);
  const {toast} = useToast();

  const form = useForm<PasswordFormData>({
    resolver: zodResolver(PasswordSchema),
    defaultValues: {password: ''},
  });

  const checkSession = useCallback(() => {
    const passwordAuth = sessionStorage.getItem('risoca-password-auth') === 'true';
    const passkeyAuth = sessionStorage.getItem('risoca-passkey-auth') === 'true';

    if (passkeyAuth) {
      setAuthStep(AuthStep.Authenticated);
    } else if (passwordAuth) {
      setAuthStep(AuthStep.Passkey);
    } else {
      setAuthStep(AuthStep.Password);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (authStep === AuthStep.Passkey) {
      const fetchAuthenticators = async () => {
        setIsSubmitting(true);
        const existing = await getAuthenticators();
        setAuthenticators(existing);
        setIsSubmitting(false);
      };
      fetchAuthenticators();
    }
  }, [authStep]);

  const handlePasswordSubmit = async (data: PasswordFormData) => {
    setIsSubmitting(true);
    const response = await verifyPassword(data.password);
    if (response.success) {
      sessionStorage.setItem('risoca-password-auth', 'true');
      setAuthStep(AuthStep.Passkey);
      toast({variant: 'success', title: 'Password Verified'});
    } else {
      form.setError('password', {
        type: 'manual',
        message: 'Incorrect password.',
      });
      toast({variant: 'destructive', title: 'Access Denied'});
    }
    setIsSubmitting(false);
  };

  const handleRegisterDevice = async () => {
    setIsSubmitting(true);
    try {
      const options = await getRegistrationOptions();
      const response = await startRegistration(options);
      const {verified, message} = await verifyNewRegistration(response);

      if (verified) {
        toast({variant: 'success', title: 'Device Registered Successfully!'});
        const existing = await getAuthenticators();
        setAuthenticators(existing);
      } else {
        throw new Error(message || 'Registration failed.');
      }
    } catch (error) {
      console.error(error);
      const errorMessage = (error as Error).message;
      if (!errorMessage.includes('cancelled')) {
        toast({
          variant: 'destructive',
          title: 'Registration Failed',
          description: errorMessage,
        });
      }
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
          title: 'No Devices Registered',
          description:
            'Please register a device first before trying to log in.',
        });
        setIsSubmitting(false);
        return;
      }
      const response = await startAuthentication(options);
      const {verified} = await verifyExistingAuthentication(response);

      if (verified) {
        sessionStorage.setItem('risoca-passkey-auth', 'true');
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

  const renderPasswordScreen = () => (
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

  const renderPasskeyScreen = () => (
    <div className="flex h-full w-full items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md animate-enter">
        <CardHeader className="text-center">
          <Fingerprint className="mx-auto h-12 w-12 text-success" />
          <CardTitle className="!mt-4">Quick Access Setup</CardTitle>
          <CardDescription>
            Use a Passkey (Fingerprint, Face, PIN, or Hardware Key) for faster,
            more secure logins.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {authenticators.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-center text-muted-foreground">
                You have {authenticators.length} registered device(s).
              </p>
              <Button
                onClick={handleAuthenticate}
                disabled={isSubmitting}
                className="w-full"
                size="lg"
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 animate-spin" />
                ) : (
                  <Fingerprint className="mr-2" />
                )}
                Login with Passkey
              </Button>
            </div>
          )}

          <div className="relative">
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
            onClick={handleRegisterDevice}
            disabled={isSubmitting}
            variant="secondary"
            className="w-full"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <PlusCircle className="mr-2" />
            Register a New Device
          </Button>
        </CardContent>
        <CardFooter className="text-center text-xs text-muted-foreground">
          You only need to do this once per device.
        </CardFooter>
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

  if (authStep === AuthStep.Password) {
    return renderPasswordScreen();
  }

  if (authStep === AuthStep.Passkey) {
    return renderPasskeyScreen();
  }

  if (authStep === AuthStep.Authenticated) {
    return <>{children}</>;
  }

  return null;
}
