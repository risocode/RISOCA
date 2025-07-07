'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {
  Home,
  Boxes,
  Plus,
  Package,
  Store,
} from 'lucide-react';
import {cn} from '@/lib/utils';
import {Button} from '@/components/ui/button';

const navItems = [
  {href: '/', icon: Home, label: 'Home'},
  {href: '/store/inventory', icon: Boxes, label: 'Inventory'},
  {href: '#add-product', icon: Plus, label: 'Add Product', isCentral: true},
  {href: '/store/inventory', icon: Package, label: 'Products'},
  {href: '/store', icon: Store, label: 'Store'},
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 h-20 bg-card border-t z-50">
      <nav className="flex items-center justify-around h-full max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive =
            (item.href === '/' && pathname === '/') ||
            (item.href !== '/' && pathname.startsWith(item.href));

          if (item.isCentral) {
            return (
              <Link href="/store/inventory" key={item.label} className="-mt-8">
                <Button
                  size="icon"
                  className="w-16 h-16 rounded-full bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg"
                >
                  <Plus className="w-8 h-8" />
                  <span className="sr-only">{item.label}</span>
                </Button>
              </Link>
            );
          }

          return (
            <Link
              href={item.href}
              key={item.label}
              className={cn(
                'flex flex-col items-center justify-center space-y-1 w-16 h-16 rounded-lg transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:bg-muted/50'
              )}
            >
              <item.icon className="w-6 h-6" />
              <span className="text-xs">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
