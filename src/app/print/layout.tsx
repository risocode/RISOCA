import '../globals.css';

// This is a minimal layout specifically for the print routes.
// By removing the <html> and <body> tags, we prevent them from
// being nested inside the root layout, which was causing hydration errors.
// The root layout now handles serving a minimal document for this route.
export default function PrintLayout({children}: {children: React.ReactNode}) {
  return <>{children}</>;
}
