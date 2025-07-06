import type {Metadata} from 'next';
import {Inter} from 'next/font/google';
import './globals.css';
import {ReceiptsProvider} from '@/contexts/ReceiptContext';
import {
  Sidebar,
  SidebarProvider,
  SidebarInset,
} from '@/components/ui/sidebar';
import {AppSidebar} from './components/app-sidebar';
import {Toaster} from '@/components/ui/toaster';
import {MobileHeader} from './components/mobile-header';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: 'RiSoCa Bot',
  description: 'Scan receipts with AI using this installable web app.',
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
        <meta name="application-name" content="RiSoCa Bot" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="RiSoCaBot" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#0f172a" />

        <link
          rel="apple-touch-icon"
          href="https://placehold.co/192x192.png"
        />
      </head>
      <body className="font-body antialiased h-full">
        <ReceiptsProvider>
          <SidebarProvider>
            <Sidebar>
              <AppSidebar />
            </Sidebar>
            <SidebarInset>
              <MobileHeader />
              {children}
            </SidebarInset>
          </SidebarProvider>
        </ReceiptsProvider>
        <Toaster />
      </body>
    </html>
  );
}
