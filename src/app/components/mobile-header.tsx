'use client';

import {SidebarTrigger} from '@/components/ui/sidebar';
import Image from 'next/image';

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 md:hidden">
      <SidebarTrigger />
      <div className="flex items-center">
        <Image
          src="/logo.png"
          alt="RISOCA Logo"
          width={90}
          height={28}
          className="w-auto h-7"
        />
      </div>
    </header>
  );
}
