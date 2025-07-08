
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

// This interface is needed to extend the default Event type for the beforeinstallprompt event.
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function InstallPwa() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for the custom event
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Cleanup listener on component unmount
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!prompt) {
      return;
    }
    // Show the browser's installation prompt
    const { outcome } = await prompt.prompt();
    
    // We've used the prompt, and it can't be used again, so nullify it
    setPrompt(null);
    
    if (outcome === 'accepted') {
      toast({
        variant: 'success',
        title: 'App Installed',
      });
    }
  };

  if (!prompt) {
    return null;
  }

  return (
    <div className="fixed bottom-24 right-4 z-50 animate-enter sm:bottom-6">
        <Card className="flex items-center gap-3 p-3 shadow-2xl">
            <div className="flex-shrink-0 bg-primary/10 text-primary p-2 rounded-lg">
                <Download className="h-6 w-6"/>
            </div>
            <div className="flex-grow pr-2">
                <p className="font-semibold">Install RiSoCa App</p>
                <p className="text-sm text-muted-foreground">For a better experience on your device.</p>
            </div>
            <Button onClick={handleInstallClick} size="sm">
                Install
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-1" onClick={() => setPrompt(null)}>
                <X className="h-4 w-4"/>
                <span className="sr-only">Dismiss</span>
            </Button>
        </Card>
    </div>
  );
}
