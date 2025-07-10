
'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {useToast} from '@/hooks/use-toast';
import {
  Loader2,
  PlusCircle,
  Trash2,
  Fingerprint,
  Monitor,
  Smartphone,
} from 'lucide-react';
import {usePasskey} from '@/hooks/use-passkey';
import {formatDistanceToNow} from 'date-fns';
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
  const {
    authenticators,
    registerNewPasskey,
    removePasskey,
    isLoading,
    isSupported,
  } = usePasskey();
  const {toast} = useToast();

  const [isAlertOpen, setIsAlertOpen] = React.useState(false);
  const [credentialIDToDelete, setCredentialIDToDelete] = React.useState<
    string | null
  >(null);

  const handleRegister = async () => {
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
  };

  const openDeleteAlert = (credentialID: string) => {
    setCredentialIDToDelete(credentialID);
    setIsAlertOpen(true);
  };

  const handleConfirmDelete = () => {
    if (credentialIDToDelete) {
      removePasskey(credentialIDToDelete);
      toast({
        variant: 'destructive',
        title: 'Device Removed',
      });
    }
    setCredentialIDToDelete(null);
    setIsAlertOpen(false);
  };

  const getDeviceIcon = (deviceType: string) => {
    // This is a heuristic. 'internal' usually means a biometric scanner built into the device.
    if (deviceType === 'internal') {
      return <Fingerprint className="h-6 w-6 text-primary" />;
    }
    // 'singleDevice' can be a USB key or other external authenticator.
    return <Monitor className="h-6 w-6 text-primary" />;
  };

  return (
    <>
      <div className="flex flex-1 flex-col p-4 md:p-6 space-y-4">
        <header>
          <h1 className="text-2xl font-bold">Settings</h1>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Fingerprint Login</CardTitle>
            <CardDescription>
              Register your mobile device to log in quickly and securely with
              its built-in fingerprint or face scanner. Keys are stored only on
              this device.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isSupported ? (
              <>
                <Button
                  onClick={handleRegister}
                  disabled={isLoading}
                  className="w-full sm:w-auto"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 animate-spin" />
                  ) : (
                    <PlusCircle className="mr-2" />
                  )}
                  Register This Device
                </Button>
                <div className="space-y-2 pt-4">
                  <h3 className="text-lg font-semibold">Registered Devices</h3>
                  {authenticators.length > 0 ? (
                    <ul className="space-y-2">
                      {authenticators.map((auth) => (
                        <li
                          key={auth.credentialID}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            {getDeviceIcon(auth.credentialDeviceType)}
                            <div>
                              <p className="font-medium">
                                This{' '}
                                {auth.credentialDeviceType === 'internal'
                                  ? 'Device'
                                  : 'Security Key'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Added{' '}
                                {formatDistanceToNow(new Date(auth.createdAt), {
                                  addSuffix: true,
                                })}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteAlert(auth.credentialID)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No devices registered yet.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-destructive font-medium p-4 border border-destructive/50 bg-destructive/10 rounded-md text-center">
                Fingerprint/Face login is only available on mobile devices.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the Passkey from this device. You will no longer
              be able to use it to log in. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setCredentialIDToDelete(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Remove Passkey
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
