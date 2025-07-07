import type {Metadata} from 'next';
import {Inter} from 'next/font/google';
import './globals.css';
import {ReceiptsProvider} from '@/contexts/ReceiptContext';
import {Toaster} from '@/components/ui/toaster';
import {SiteProtection} from './components/site-protection';
import {BottomNav} from './components/bottom-nav';
import {SiteHeader} from '@/app/components/site-header';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

export const metadata: Metadata = {
  manifest: '/manifest.webmanifest',
  title: 'Sales Dashboard',
  description:
    'An application for tracking sales and managing a store inventory.',
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
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#111317" />

        <link rel="icon" href="/favicon.ico" />
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
        </SiteProtection>
      </body>
    </html>
  );
}
