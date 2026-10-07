'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner } from 'sonner';

/** Toasts (sonner) no canto inferior, com as cores e o texto de 14px+ do sistema. */
export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      position="bottom-center"
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      offset={{ bottom: 24 }}
      mobileOffset={{ bottom: 96 }}
      toastOptions={{
        classNames: {
          toast: '!rounded-xl !border !border-border !bg-surface !p-4 !font-sans !text-sm !text-fg !shadow-lg',
          title: '!text-sm !font-semibold',
          description: '!text-sm !text-fg-muted',
        },
      }}
    />
  );
}
