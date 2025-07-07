import {Inter} from 'next/font/google';
import '../globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

// This is a minimal layout specifically for the print routes.
// It does not include any site navigation, headers, or footers.
export default function PrintLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className="h-full">
      <body className="font-body antialiased h-full bg-white text-black">
        {children}
      </body>
    </html>
  );
}
