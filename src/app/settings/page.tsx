
'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col p-4 md:p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Settings</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Application Settings</CardTitle>
          <CardDescription>
            Manage your application preferences here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            More settings will be available in a future update.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
