'use client';

import {Settings} from 'lucide-react';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col p-4 md:p-6 space-y-4 opacity-0 animate-page-enter">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings /> Settings
        </h1>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Under Construction</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm min-h-[400px]">
            <div className="text-center">
              <p className="text-muted-foreground">
                The settings page is not yet implemented.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
