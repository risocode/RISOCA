import type {Metadata, Viewport} from 'next';
import {Inter} from 'next/font/google';
import './globals.css';
import {ReceiptsProvider} from '@/contexts/ReceiptContext';
import {Toaster} from '@/components/ui/toaster';
import {SiteProtection} from './components/site-protection';
import {BottomNav} from './components/bottom-nav';
import {SiteHeader} from '@/app/components/site-header';
import { InstallPwa } from './components/install-pwa';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

export const metadata: Metadata = {
  applicationName: 'Risoca',
  title: 'Risoca',
  description:
    'An application for tracking sales, expenses, and managing a store inventory.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Risoca',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/icon-192x192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#111317',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="font-body antialiased h-full bg-background">
        <SiteProtection>
          <ReceiptsProvider>
            <div className="relative flex flex-col h-full">
              <SiteHeader />
              <main className="flex-1 pb-24 overflow-y-auto">{children}</main>
              <BottomNav />
            </div>
          </ReceiptsProvider>
          <Toaster />
          <InstallPwa />
        </SiteProtection>
      </body>
    </html>
  );
}
