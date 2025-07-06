
'use client';

import {useState} from 'react';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert';
import {ShieldAlert, LogIn} from 'lucide-react';
import Image from 'next/image';

interface PasswordProtectProps {
  onSuccess: () => void;
}

export function PasswordProtect({onSuccess}: PasswordProtectProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === process.env.NEXT_PUBLIC_SITE_PASSWORD) {
      setError('');
      onSuccess();
    } else {
      setError('Incorrect password. Please try again.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-sm shadow-2xl animate-enter">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
             <Image
                src="/logo.png"
                alt="RISOCA Logo"
                width={120}
                height={37}
                className="w-auto h-9 logo-glow"
                data-ai-hint="logo"
            />
          </div>
          <CardTitle>Protected Area</CardTitle>
          <CardDescription>
            Please enter the password to access this site.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="text-center"
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full">
              <LogIn className="mr-2"/>
              Unlock
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
