'use client';

import { MotionConfig } from 'motion/react';
import { ThemeProvider } from 'next-themes';
import { useEffect, type ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { fetcher } from '@/lib/api-client';
import { useAppNativo } from '@/lib/app-nativo';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';

export function Providers({ children }: { children: ReactNode }) {
  const app = useAppNativo();
  // data-app="nativo" no <html> liga o variant `app:` do CSS (globals.css).
  useEffect(() => {
    if (app) document.documentElement.dataset.app = 'nativo';
  }, [app]);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {/* No app, sem animações de movimento (o WebView engasga); só opacidade continua. */}
      <MotionConfig reducedMotion={app ? 'always' : 'user'}>
        <SWRConfig value={{ fetcher, revalidateOnFocus: true, refreshWhenHidden: false, shouldRetryOnError: false }}>
          <TooltipProvider delayDuration={300}>
            {children}
            <Toaster />
          </TooltipProvider>
        </SWRConfig>
      </MotionConfig>
    </ThemeProvider>
  );
}
