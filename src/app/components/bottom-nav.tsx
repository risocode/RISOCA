'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {
  LayoutDashboard,
  Boxes,
  BarChart3,
  Settings,
  Store,
} from 'lucide-react';
import {cn} from '@/lib/utils';

const navItems = [
  {href: '/', icon: LayoutDashboard, label: 'Home'},
  {href: '/store/inventory', icon: Boxes, label: 'Inventory'},
  {href: '/store/history', icon: BarChart3, label: 'Reports'},
  {href: '/settings', icon: Settings, label: 'Settings'},
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 h-20 bg-card border-t z-50 shadow-[0_-1px_10px_rgba(0,0,0,0.05)]">
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

        <div className="w-20" /> {/* Spacer for the FAB */}

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
      <Link
        href="/store"
        className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/3 bg-accent hover:bg-accent/90 text-accent-foreground rounded-full w-16 h-16 flex items-center justify-center shadow-lg transition-transform hover:scale-105"
      >
        <Store className="w-8 h-8" />
        <span className="sr-only">New Sale</span>
      </Link>
    </div>
  );
}
