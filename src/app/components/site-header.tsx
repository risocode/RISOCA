import Link from 'next/link';
import Image from 'next/image';

export function SiteHeader() {
  return (
    <header className="flex items-center justify-center p-4">
      <Link href="/" className="flex items-center justify-center">
        <Image
          src="/logo.png?v=7"
          alt="App Logo"
          width={40}
          height={40}
          priority
          data-ai-hint="abstract logo"
          className="w-auto h-9"
        />
        <Image
          src="/risoca.png?v=7"
          alt="RiSoCa Logo Text"
          width={120}
          height={37}
          priority
          data-ai-hint="text logo"
          className="w-auto h-8"
        />
      </Link>
    </header>
  );
}
