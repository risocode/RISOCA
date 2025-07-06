'use client';

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {LayoutDashboard} from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <LayoutDashboard className="w-16 h-16 mb-4 text-muted-foreground" />
      <h2 className="text-2xl font-semibold">Dashboard</h2>
      <p className="max-w-md mt-2 text-muted-foreground">
        This page is currently empty.
      </p>
    </div>
  );
}
