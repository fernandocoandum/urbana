'use client';

import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';

/** Sino de notificações. O popover, o contador e o polling chegam na Etapa H. */
export function NotificationBell() {
  return (
    <Tip label="Notificações">
      <Button variant="ghost" size="icon" aria-label="Notificações">
        <Bell />
      </Button>
    </Tip>
  );
}
