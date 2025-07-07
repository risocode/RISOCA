import type {Metadata} from 'next';
import {Inter} from 'next/font/google';
import './globals.css';
import {ReceiptsProvider} from '@/contexts/ReceiptContext';
import {Toaster} from '@/components/ui/toaster';
import {SiteProtection} from './components/site-protection';
import {BottomNav} from './components/bottom-nav';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: 'Sales Dashboard',
  description:
    'An application for tracking sales and managing a store inventory.',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
        />
        <meta name="application-name" content="RiSoCa Receipt" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="RiSoCa Receipt" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#ffffff" />

        <link rel="icon" href="/icons/favicon.ico" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="font-body antialiased h-full bg-background">
        <SiteProtection>
          <ReceiptsProvider>
            <div className="relative flex flex-col h-full">
              <main className="flex-1 pb-24">{children}</main>
              <BottomNav />
            </div>
          </ReceiptsProvider>
          <Toaster />
        </SiteProtection>
      </body>
    </html>
  );
}
