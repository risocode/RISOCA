
'use client';

import {useState} from 'react';
import {useZxing} from 'react-zxing';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert';
import {Button} from './ui/button';

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
  const {ref} = useZxing({
    onDecodeResult(result) {
      onScan(result.getText());
    },
    onError(err) {
      console.error('Barcode scanner error:', err);
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError(
          'Camera access was denied. Please allow camera access in your browser settings to use the scanner.'
        );
      } else {
        setError('Could not start the camera. Please ensure it is not being used by another application.');
      }
    },
    paused: !open,
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
          {error ? (
            <div className="flex items-center justify-center h-full p-4">
              <Alert variant="destructive">
                <AlertTitle>Camera Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          ) : (
            <video ref={ref} className="w-full h-full object-cover" />
          )}
           <div className="absolute inset-0 border-4 border-primary/50 rounded-md pointer-events-none" />
        </div>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}
