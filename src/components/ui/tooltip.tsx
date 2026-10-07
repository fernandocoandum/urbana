'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Tooltip as TooltipPrimitive } from 'radix-ui';
import { createContext, useContext, type ReactNode } from 'react';
import { duration } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { useOpenState } from './use-open';

const OpenContext = createContext(false);

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({ open, defaultOpen, onOpenChange, children }: { open?: boolean; defaultOpen?: boolean; onOpenChange?: (o: boolean) => void; children: ReactNode }) {
  const [current, set] = useOpenState(open, defaultOpen, onOpenChange);
  return (
    <OpenContext.Provider value={current}>
      <TooltipPrimitive.Root open={current} onOpenChange={set}>
        {children}
      </TooltipPrimitive.Root>
    </OpenContext.Provider>
  );
}
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({ className, side = 'top', sideOffset = 8, children }: { className?: string; side?: 'top' | 'right' | 'bottom' | 'left'; sideOffset?: number; children?: ReactNode }) {
  const open = useContext(OpenContext);
  return (
    <AnimatePresence>
      {open && (
        <TooltipPrimitive.Portal forceMount>
          <TooltipPrimitive.Content asChild forceMount side={side} sideOffset={sideOffset} collisionPadding={8}>
            <motion.div
              className={cn('z-[60] max-w-[260px] rounded-lg bg-fg px-3 py-2 text-sm font-medium text-bg shadow-md', className)}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: duration.fast }}
            >
              {children}
            </motion.div>
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      )}
    </AnimatePresence>
  );
}

/** Atalho: <Tip label="Texto"><button/></Tip>. */
export function Tip({ label, side, children }: { label: string; side?: 'top' | 'right' | 'bottom' | 'left'; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
