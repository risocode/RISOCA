
'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Fingerprint, Loader2 } from 'lucide-react';
import { usePasskey } from '@/hooks/use-passkey';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const { toast } = useToast();
  const { 
    isPasskeyLoading, 
    isPasskeySupported, 
    hasRegisteredPasskey, 
    registerNewPasskey 
  } = usePasskey({
    onRegisterSuccess: () => {
      toast({
        variant: 'success',
        title: 'Passkey Registered',
        description: 'You can now use your fingerprint to log in.',
      });
    },
    onRegisterError: (error: string) => {
      toast({
        variant: 'destructive',
        title: 'Registration Failed',
        description: error,
      });
    },
  });

  return (
    <div className="flex flex-1 flex-col p-4 md:p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Settings</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Application Settings</CardTitle>
          <CardDescription>
            Manage your application preferences here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            More settings will be available in a future update.
          </p>
        </CardContent>
      </Card>
      
      {isPasskeySupported && (
        <Card>
          <CardHeader>
            <CardTitle>Passkey Authentication</CardTitle>
            <CardDescription>
              Use your device's fingerprint or face recognition for faster, more secure logins.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasRegisteredPasskey ? (
              <p className="text-sm text-success font-medium">
                A passkey is registered for this site.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No passkey registered for this site on this browser.
              </p>
            )}
          </CardContent>
          <CardContent>
             <Button onClick={registerNewPasskey} disabled={isPasskeyLoading}>
              {isPasskeyLoading ? (
                <Loader2 className="mr-2 animate-spin" />
              ) : (
                <Fingerprint className="mr-2" />
              )}
              {hasRegisteredPasskey ? 'Register a New Passkey' : 'Register this Device'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
