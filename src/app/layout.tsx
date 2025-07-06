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

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: 'AI Receipt Scanner',
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
        <meta name="application-name" content="AI Receipt Scanner" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ReceiptScanner" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#0f172a" />

        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <link
          rel="manifest"
          href="data:application/manifest+json;base64,eyJuYW1lIjoiQUkgUmVjZWlwdCBTY2FubmVyIiwic2hvcnRfbmFtZSI6IlJlY2VpcHRTY2FubmVyIiwiZGVzY3JpcHRpb24iOiJTY2FuIHJlY2VpcHRzIHdpdGggQUkiLCJzdGFydF91cmwiOiIvIiwiZGlzcGxheSI6InN0YW5kYWxvbmUiLCJiYWNrZ3JvdW5kX2NvbG9yIjoiIzBmMTcyYSIsInRoZW1lX2NvbG9yIjoiIzBmMTcyYSIsImljb25zIjpbeyJzcmMiOiJodHRwczovL3BsYWNlaG9sZC5jby8xOTJ4MTkyLnBuZyIsInNpemVzIjoiMTkyeDE5MiIsInR5cGUiOiJpbWFnZS9wbmciLCJwdXJwb3NlIjoiYW55IG1hc2thYmxlIn0seyJzcmMiOiJodHRwczovL3BsYWNlaG9sZC5jby81MTJ4NTEyLnBuZyIsInNpemVzIjoiNTEyeDUxMiIsInR5cGUiOiJpbWFnZS9wbmciLCJwdXJwb3NlIjoiYW55IG1hc2thYmxlIn1dfQ=="
        />
      </head>
      <body className="font-body antialiased h-full">
        <ReceiptsProvider>
          <SidebarProvider>
            <Sidebar>
              <AppSidebar />
            </Sidebar>
            <SidebarInset>{children}</SidebarInset>
          </SidebarProvider>
        </ReceiptsProvider>
      </body>
    </html>
  );
}
