'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {LayoutDashboard, Boxes, BarChart3, Settings} from 'lucide-react';
import {cn} from '@/lib/utils';

const navItems = [
  {href: '/', icon: LayoutDashboard, label: 'Dashboard'},
  {href: '/store/inventory', icon: Boxes, label: 'Inventory'},
  {href: '/store/history', icon: BarChart3, label: 'Reports'},
  {href: '/settings', icon: Settings, label: 'Settings'},
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 h-20 bg-card border-t z-50">
      <nav className="flex items-center justify-around h-full max-w-lg mx-auto">
        {navItems.map((item) => {
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
                  : 'text-muted-foreground hover:bg-muted/50'
              )}
            >
              <item.icon className="w-6 h-6" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
