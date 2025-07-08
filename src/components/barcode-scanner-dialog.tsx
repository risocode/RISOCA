
'use client';

import { useState, useEffect } from 'react';
import { useZxing } from 'react-zxing';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from './ui/button';
import { Loader2 } from 'lucide-react';

interface BarcodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (result: string) => void;
}

export function BarcodeScannerDialog({
  open,
  onOpenChange,
  onScan,
}: BarcodeScannerDialogProps) {
  const [error, setError] = useState('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    if (open) {
      // Reset state each time the dialog opens
      setHasPermission(null);
      setError('');
      
      const requestPermission = async () => {
        try {
          // Request permission to trigger the browser prompt
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          // We got permission. Stop the tracks immediately because useZxing will manage its own stream.
          stream.getTracks().forEach(track => track.stop());
          setHasPermission(true);
        } catch (err) {
          console.error('Camera permission error:', err);
          if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'NotFoundError')) {
            setError('Camera access was denied or no camera was found. Please allow camera access in your browser settings to use the scanner.');
          } else {
            setError('Could not start the camera. Please ensure it is not being used by another application.');
          }
          setHasPermission(false);
        }
      };
      
      requestPermission();
    }
  }, [open]);

  const { ref } = useZxing({
    onDecodeResult(result) {
      onScan(result.getText());
    },
    onError(err) {
      // This is a fallback for errors during operation, after permission is granted.
      console.error('Barcode scanner runtime error:', err);
      setError('An unexpected error occurred while using the camera.');
      setHasPermission(false);
    },
    // Only start the scanner if the dialog is open and we have confirmed permission
    paused: !open || hasPermission !== true,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan Barcode</DialogTitle>
          <DialogDescription>
            Point your camera at a barcode to scan it.
          </DialogDescription>
        </DialogHeader>
        <div className="relative w-full aspect-video bg-black rounded-md overflow-hidden">
          {hasPermission === null && (
             <div className="flex flex-col items-center justify-center h-full p-4 text-center text-white">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p>Requesting camera permission...</p>
                <p className="text-sm text-white/70 mt-1">Please check your browser for a permission prompt.</p>
             </div>
          )}
          {hasPermission === false && (
            <div className="flex items-center justify-center h-full p-4">
              <Alert variant="destructive">
                <AlertTitle>Camera Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}
          {hasPermission === true && (
            <>
              <video ref={ref} className="w-full h-full object-cover" />
              <div className="absolute inset-0 border-4 border-primary/50 rounded-md pointer-events-none" />
            </>
          )}
        </div>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}
