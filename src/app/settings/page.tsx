
'use client';

import {useState, useEffect, useCallback} from 'react';
import {
  getAuthenticators,
  getRegistrationOptions,
  verifyNewRegistration,
  deleteAuthenticator,
} from '@/app/actions';
import {startRegistration} from '@simplewebauthn/browser';
import type {Authenticator} from '@/lib/schemas';
import {format} from 'date-fns';

import {Button} from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {useToast} from '@/hooks/use-toast';
import {
  Settings,
  PlusCircle,
  Loader2,
  Fingerprint,
  Trash2,
  Laptop,
  Smartphone,
  KeyRound
} from 'lucide-react';
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

export default function SettingsPage() {
  const [authenticators, setAuthenticators] = useState<Authenticator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const {toast} = useToast();

  const fetchAuthenticators = useCallback(async () => {
    setIsLoading(true);
    try {
      const existing = await getAuthenticators();
      setAuthenticators(existing);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not fetch your registered devices.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAuthenticators();
  }, [fetchAuthenticators]);

  const handleRegisterDevice = async () => {
    setIsSubmitting(true);
    try {
      const options = await getRegistrationOptions();
      const response = await startRegistration(options);
      const {verified, message} = await verifyNewRegistration(response);

      if (verified) {
        toast({
          variant: 'success',
          title: 'Device Registered Successfully!',
        });
        await fetchAuthenticators(); // Refresh the list
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

  const handleOpenDeleteDialog = (id: string) => {
    setDeletingId(id);
    setIsAlertOpen(true);
  };
  
  const handleDeleteAuthenticator = async () => {
    if (!deletingId) return;

    const response = await deleteAuthenticator(deletingId);

    if (response.success) {
      toast({
        variant: 'destructive',
        title: 'Passkey Deleted',
      });
      setAuthenticators(prev => prev.filter(auth => auth.id !== deletingId));
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: response.message || 'An unknown error occurred.',
      });
    }
    setIsAlertOpen(false);
    setDeletingId(null);
  };

  const getDeviceIcon = (deviceType: string | undefined) => {
    switch (deviceType) {
      case 'internal':
        return <Fingerprint className="h-5 w-5" />;
      case 'hybrid':
        return <Smartphone className="h-5 w-5" />;
      default:
        return <KeyRound className="h-5 w-5" />;
    }
  }

  return (
    <>
      <div className="flex flex-1 flex-col p-4 md:p-6 space-y-4 opacity-0 animate-page-enter">
        <header>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings /> Settings
          </h1>
        </header>
        <Card>
          <CardHeader>
            <CardTitle>Passkey Management</CardTitle>
            <CardDescription>
              Add or remove Passkeys (Fingerprint, Face ID, etc.) for quick and
              secure access to your app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-medium mb-2">Registered Devices</h3>
              {isLoading ? (
                <div className="space-y-2">
                  <div className="h-12 w-full animate-pulse rounded-md bg-muted"></div>
                  <div className="h-12 w-full animate-pulse rounded-md bg-muted"></div>
                </div>
              ) : authenticators.length > 0 ? (
                <ul className="space-y-2">
                  {authenticators.map((auth) => (
                    <li
                      key={auth.id}
                      className="flex items-center justify-between p-3 rounded-md border"
                    >
                      <div className="flex items-center gap-3">
                         {getDeviceIcon(auth.credentialDeviceType)}
                        <div>
                          <p className="font-medium">
                            {auth.credentialDeviceType === 'internal' ? 'This Device' : 'External Key'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Added on{' '}
                            {format(auth.createdAt.toDate(), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDeleteDialog(auth.id!)}
                      >
                        <Trash2 className="h-5 w-5 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                  <p className="text-muted-foreground">
                    You have no Passkeys registered.
                  </p>
                </div>
              )}
            </div>

            <Button onClick={handleRegisterDevice} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 animate-spin" />
              ) : (
                <PlusCircle className="mr-2" />
              )}
              Register a New Device
            </Button>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the Passkey from your account. You will no longer be able to log in with this key.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAuthenticator}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete Passkey
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
