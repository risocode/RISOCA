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
        <link
          rel="manifest"
          href="data:application/manifest+json;base64,eyJuYW1lIjoiUmlTb0NhIEJvdCIsInNob3J0X25hbWUiOiJSaVNvQ2FCb3QiLCJkZXNjcmlwdGlvbiI6IlNjYW4gcmVjZWlwdHMgd2l0aCBBSSB1c2luZyB0aGlzIGluc3RhbGxhYmxlIHdlYiBhcHAuIiwic3RhcnRfdXJsIjoiLyIsImRpc3BsYXkiOiJzdGFuZGFsb25lIiwiYmFja2dyb3VuZF9jb2xvciI6IiMwZjE3MmEiLCJ0aGVtZV9jb2xvciI6IiMwZjE3MmEiLCJpY29ucyI6W3sic3JjIjoiaHR0cHM6Ly9wbGFjZWhvbGQuY28vMTkyeDE5Mi5wbmciLCJzaXplcyI6IjE5MngxOTIiLCJ0eXBlIjoiaW1hZ2UvcG5nIiwicHVycG9zZSI6ImFueSBtYXNrYWJsZSJ9LHsic3JjIjoiaHR0cHM6Ly9wbGFjZWhvbGQuY28vNTEyeDUxMi5wbmciLCJzaXplcyI6IjUxMng1MTIiLCJ0eXBlIjoiaW1hZ2UvcG5nIiwicHVycG9zZSI6ImFueSBtYXNrYWJsZSJ9XX0="
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
