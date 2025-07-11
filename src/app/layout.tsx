
import type {Metadata, Viewport} from 'next';
import {Inter} from 'next/font/google';
import './globals.css';
import {ReceiptsProvider} from '@/contexts/ReceiptContext';
import {Toaster} from '@/components/ui/toaster';
import {BottomNav} from './components/bottom-nav';
import {SiteHeader} from '@/app/components/site-header';
import {InstallPwa} from './components/install-pwa';
import {headers} from 'next/headers';
import {SiteProtection} from './components/site-protection';
import {cn} from '@/lib/utils';

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
  manifest: '/manifest.json?v=8',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Risoca',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#1a2424',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = headers();
  const pathname = headersList.get('x-next-pathname') || '';
  const isPrintRoute = pathname.startsWith('/print');
  
  const mainContent = (
    <div className="relative flex flex-col h-full">
      <SiteHeader />
      <main className="flex-1 pb-24 overflow-y-auto main-scroll-area">{children}</main>
      <BottomNav />
      <InstallPwa />
    </div>
  );

  // For print routes, render a completely minimal HTML document.
  if (isPrintRoute) {
    return (
      <html lang="en" className="h-full">
        <body className="font-body antialiased h-full bg-white text-black">
          {children}
        </body>
      </html>
    );
  }

  return (
    <html lang="en" className="h-full">
      <head>
        <meta
            httpEquiv="Permissions-Policy"
            content="publickey-credentials-get=(self), publickey-credentials-create=(self)"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=8" />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png?v=8"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png?v=8"
        />
        <link rel="shortcut icon" href="/favicon.ico?v=8" />
        <link rel="manifest" href="/manifest.webmanifest?v=8" />
      </head>
      <body className="font-body antialiased h-full bg-background">
        <ReceiptsProvider>
            <SiteProtection>{mainContent}</SiteProtection>
        </ReceiptsProvider>
        <Toaster />
      </body>
    </html>
  );
}
