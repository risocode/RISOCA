import Link from 'next/link';
import Image from 'next/image';

export function SiteHeader() {
  return (
    <header className="main-site-header flex items-center justify-center p-4">
      <Link href="/" className="flex items-center justify-center gap-2">
        <Image
          src="/logo.png?v=8"
          alt="App Logo"
          width={40}
          height={40}
          priority
          data-ai-hint="abstract logo"
          className="w-auto h-9"
        />
        <span className="text-xl font-bold">Whole Store</span>
      </Link>
    </header>
  );
}
