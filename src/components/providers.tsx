'use client';

import { MotionConfig } from 'motion/react';
import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { fetcher } from '@/lib/api-client';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <MotionConfig reducedMotion="user">
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
