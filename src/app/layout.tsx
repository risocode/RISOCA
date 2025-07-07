import type {Metadata, Viewport} from 'next';
import {Inter} from 'next/font/google';
import './globals.css';
import {ReceiptsProvider} from '@/contexts/ReceiptContext';
import {Toaster} from '@/components/ui/toaster';
import {SiteProtection} from './components/site-protection';
import {BottomNav} from './components/bottom-nav';
import {SiteHeader} from '@/app/components/site-header';
import {InstallPwa} from './components/install-pwa';
import {headers} from 'next/headers';

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
  manifest: '/manifest.json?v=6',
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
  const headersList = headers();
  const pathname = headersList.get('x-next-pathname') || '';
  const isPrintRoute = pathname.startsWith('/print');

  // For print routes, render a completely minimal HTML document.
  // This prevents the main app's UI, providers, and scripts from
  // loading on the print page, which resolves all errors.
  if (isPrintRoute) {
    return (
      <html lang="en" className="h-full">
        <body className="font-body antialiased h-full bg-white text-black">
          {children}
        </body>
      </html>
    );
  }

  // For all other routes, render the full application layout.
  return (
    <html lang="en" className="dark h-full">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=6" />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png?v=6"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png?v=6"
        />
        <link rel="shortcut icon" href="/favicon.ico?v=6" />
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
