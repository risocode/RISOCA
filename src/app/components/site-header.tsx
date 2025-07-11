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
        <Image
          src="/risoca.png?v=8"
          alt="RiSoCa Logo Text"
          width={120}
          height={36}
          priority
          className="w-auto h-8"
        />
      </Link>
    </header>
  );
}
