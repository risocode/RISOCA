'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {Store, BookUser} from 'lucide-react';

export function AppSidebar() {
  return (
    <>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="RISOCA Logo"
            width={90}
            height={28}
            className="w-auto h-7 logo-glow"
            priority
          />
          <div className="grow" />
          <SidebarTrigger className="hidden md:flex" />
        </div>
      </SidebarHeader>
      <SidebarMenu className="p-4 pt-0">
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link href="/store">
              <Store />
              <span>RiSoCa Store</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link href="/store/ledger">
              <BookUser />
              <span>Credit Ledger</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </>
  );
}
