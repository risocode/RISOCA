'use client';

import {Settings} from 'lucide-react';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col p-4 md:p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings /> Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your application settings.
        </p>
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
