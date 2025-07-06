'use client';

import {SidebarTrigger} from '@/components/ui/sidebar';
import {Bot} from 'lucide-react';

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 md:hidden">
      <SidebarTrigger />
      <div className="flex items-center gap-2">
        <Bot className="w-6 h-6 text-primary" />
        <h1 className="text-lg font-semibold">RiSoCa Bot</h1>
      </div>
    </header>
  );
}
