
'use client';

import {useState, useEffect} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert';
import {Separator} from '@/components/ui/separator';
import {
  ShieldAlert,
  LogIn,
  Loader2,
  Fingerprint,
  KeyRound,
} from 'lucide-react';
import {verifyPassword} from '@/app/actions';
import {useToast} from '@/hooks/use-toast';

interface PasswordProtectProps {
  onSuccess: () => void;
}

// We need a unique identifier for the credential store.
// Using a prefix helps avoid collisions in localStorage.
const WEBAUTHN_LS_KEY_REGISTERED = 'risoca_webauthn_registered';
const WEBAUTHN_LS_KEY_CREDENTIAL_ID = 'risoca_webauthn_credential_id';

export function PasswordProtect({onSuccess}: PasswordProtectProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);

  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [isBiometricRegistered, setIsBiometricRegistered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const {toast} = useToast();

  useEffect(() => {
    // This check runs on the client to determine if it's a mobile device.
    setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));

    const checkSupport = async () => {
      const supported = await browserSupportsWebAuthn();
      setIsBiometricSupported(supported);
      if (supported && localStorage.getItem(WEBAUTHN_LS_KEY_REGISTERED) === 'true') {
        setIsBiometricRegistered(true);
      }
    };
    checkSupport();
  }, []);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsVerifying(true);

    try {
      const result = await verifyPassword(password);
      if (result.success) {
        // Only show the biometric registration prompt on mobile devices, as requested.
        if (isBiometricSupported && !isBiometricRegistered && isMobile) {
          setShowRegisterPrompt(true);
        } else {
          onSuccess();
        }
      } else {
        setError('Incorrect password. Please try again.');
        setPassword('');
      }
    } catch (err) {
      console.error('Password verification error:', err);
      setError('An error occurred. Please try again later.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRegisterBiometrics = async () => {
    setIsVerifying(true);
    setError('');
    try {
      const reg = await startRegistration({
        rp: {name: 'RiSoCa Receipt', id: window.location.hostname},
        user: {id: 'user', name: 'user', displayName: 'RiSoCa User'},
        challenge: 'risoca_challenge_' + Date.now(),
        pubKeyCredParams: [{type: 'public-key', alg: -7}],
        authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
        },
        timeout: 60000,
        attestation: 'none',
      });
      
      localStorage.setItem(WEBAUTHN_LS_KEY_REGISTERED, 'true');
      localStorage.setItem(WEBAUTHN_LS_KEY_CREDENTIAL_ID, reg.id);
      setIsBiometricRegistered(true);
      toast({
          variant: 'success',
          title: 'Fingerprint Enabled',
          description: 'You can now use your fingerprint to log in.',
      });
      onSuccess();
    } catch (err: any) {
        console.error('Biometric registration error:', err);
        const errorMessage = err.name === 'InvalidStateError' ? 'This device is already registered.' : 'Biometric registration failed. Please try again.';
        setError(errorMessage);
        setShowRegisterPrompt(false); // Go back to password screen
    } finally {
      setIsVerifying(false);
    }
  };
  
  const handleSkipRegistration = () => {
      setShowRegisterPrompt(false);
      onSuccess();
  }

  const handleBiometricLogin = async () => {
    setIsVerifying(true);
    setError('');
    try {
        const credentialID = localStorage.getItem(WEBAUTHN_LS_KEY_CREDENTIAL_ID);
        if (!credentialID) {
            throw new Error('No credential ID found.');
        }

        await startAuthentication({
            challenge: 'risoca_auth_challenge_' + Date.now(),
            allowCredentials: [{
                id: credentialID,
                type: 'public-key'
            }],
            userVerification: 'required',
        });

      onSuccess();
    } catch (err) {
      console.error('Biometric authentication error:', err);
      setError('Fingerprint authentication failed. Please try your password.');
    } finally {
      setIsVerifying(false);
    }
  };

  if (showRegisterPrompt) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-sm shadow-2xl animate-enter">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4 text-primary">
                <Fingerprint className="w-16 h-16" />
            </div>
            <CardTitle>Enable Faster Login?</CardTitle>
            <CardDescription>
              Use your fingerprint or face recognition to unlock the app instantly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             {error && (
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Registration Failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col gap-2">
                <Button onClick={handleRegisterBiometrics} disabled={isVerifying}>
                   {isVerifying ? <Loader2 className="mr-2 animate-spin" /> : <Fingerprint className="mr-2"/>}
                    Enable Biometric Login
                </Button>
                <Button variant="ghost" onClick={handleSkipRegistration} disabled={isVerifying}>
                    Not Now
                </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-sm shadow-2xl animate-enter">
        <CardHeader className="text-center">
          <Link href="/">
            <div className="flex items-center justify-center mb-4">
              <Image
                src="/logo.png?v=3"
                alt="App Logo"
                width={40}
                height={40}
                priority
                data-ai-hint="abstract logo"
                className="w-auto h-9"
              />
              <Image
                src="/risoca.png"
                alt="RiSoCa Logo Text"
                width={120}
                height={37}
                priority
                data-ai-hint="text logo"
                className="w-auto h-8"
              />
            </div>
          </Link>
          <CardTitle>Protected Area</CardTitle>
          <CardDescription>
            {isBiometricRegistered && isBiometricSupported 
              ? "Unlock with your fingerprint or enter the password."
              : "Please enter the password to unlock."
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isBiometricRegistered && isBiometricSupported && (
            <>
              <Button
                className="w-full h-14 text-base"
                onClick={handleBiometricLogin}
                disabled={isVerifying}
              >
                {isVerifying && <Loader2 className="mr-2 animate-spin" />}
                {!isVerifying && <Fingerprint className="mr-2" />}
                Unlock with Fingerprint
              </Button>
              <div className="relative">
                <Separator />
                <span className="absolute px-2 text-xs -translate-x-1/2 bg-card left-1/2 -top-2 text-muted-foreground">OR</span>
              </div>
            </>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="relative">
              <KeyRound className="absolute w-5 h-5 -translate-y-1/2 text-muted-foreground left-3 top-1/2" />
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="text-center pl-10"
              />
            </div>
             <Button type="submit" variant={isBiometricRegistered ? "outline" : "default"} className="w-full" disabled={isVerifying}>
              {isVerifying ? (
                <Loader2 className="mr-2 animate-spin" />
              ) : (
                <LogIn className="mr-2" />
              )}
              {isVerifying ? 'Verifying...' : 'Unlock with Password'}
            </Button>
            {error && (
               <Alert variant="destructive" className="text-center">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
