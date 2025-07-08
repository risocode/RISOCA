'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {
  Home,
  Boxes,
  History,
  Plus,
  Store,
  ReceiptText,
  Landmark,
  Wallet,
} from 'lucide-react';
import {cn} from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';
import {Button} from '@/components/ui/button';

const navItems = [
  {href: '/', icon: Home, label: 'Home'},
  {href: '/store/inventory', icon: Boxes, label: 'Products'},
  {href: '/store/ledger', icon: Landmark, label: 'Ledger'},
  {href: '/transactions', icon: History, label: 'Transactions'},
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <Sheet>
      <div className="main-bottom-nav fixed bottom-0 left-0 right-0 h-20 bg-card border-t z-50 shadow-[0_-1px_10px_rgba(0,0,0,0.05)]">
        <nav className="flex items-center justify-around h-full max-w-lg mx-auto relative">
          {navItems.slice(0, 2).map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
            return (
              <Link
                href={item.href}
                key={item.label}
                className={cn(
                  'flex flex-col items-center justify-center space-y-1 w-20 h-16 rounded-lg transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-primary'
                )}
              >
                <item.icon className="w-6 h-6" />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}

          <div className="w-20" />

          {navItems.slice(2, 4).map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                href={item.href}
                key={item.label}
                className={cn(
                  'flex flex-col items-center justify-center space-y-1 w-20 h-16 rounded-lg transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-primary'
                )}
              >
                <item.icon className="w-6 h-6" />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <SheetTrigger asChild>
          <button className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/3 bg-pink hover:bg-pink/90 text-pink-foreground rounded-full w-16 h-16 flex items-center justify-center shadow-lg transition-transform hover:scale-105">
            <Plus className="w-8 h-8" />
            <span className="sr-only">Create New</span>
          </button>
        </SheetTrigger>
      </div>

      <SheetContent
        side="bottom"
        className="rounded-t-2xl sm:max-w-xl mx-auto border-none bg-card p-6"
      >
        <SheetHeader className="mb-6">
          <SheetTitle className="text-center text-lg">Create New</SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-3 gap-4">
          <SheetClose asChild>
            <Button
              asChild
              variant="outline"
              className="h-24 flex-col gap-2 text-lg bg-background hover:bg-muted"
            >
              <Link href="/store">
                <Store className="w-8 h-8" />
                <span>Sell</span>
              </Link>
            </Button>
          </SheetClose>
          <SheetClose asChild>
            <Button
              asChild
              variant="outline"
              className="h-24 flex-col gap-2 text-lg bg-background hover:bg-muted"
            >
              <Link href="/store/receipts">
                <ReceiptText className="w-8 h-8" />
                <span>Expense</span>
              </Link>
            </Button>
          </SheetClose>
          <SheetClose asChild>
            <Button
              asChild
              variant="outline"
              className="h-24 flex-col gap-2 text-lg bg-background hover:bg-muted"
            >
              <Link href="/wallet">
                <Wallet className="w-8 h-8" />
                <span>Wallet</span>
              </Link>
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
