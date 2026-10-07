'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { createContext, useContext, type ReactNode } from 'react';
import { duration, spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { useOpenState } from './use-open';

const OpenContext = createContext(false);

export function Popover({ open, defaultOpen, onOpenChange, children }: { open?: boolean; defaultOpen?: boolean; onOpenChange?: (o: boolean) => void; children: ReactNode }) {
  const [current, set] = useOpenState(open, defaultOpen, onOpenChange);
  return (
    <OpenContext.Provider value={current}>
      <PopoverPrimitive.Root open={current} onOpenChange={set}>
        {children}
      </PopoverPrimitive.Root>
    </OpenContext.Provider>
  );
}
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

interface ContentProps {
  className?: string;
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  children?: ReactNode;
  'aria-label'?: string;
}

export function PopoverContent({ className, align = 'end', sideOffset = 10, children, ...rest }: ContentProps) {
  const open = useContext(OpenContext);
  return (
    <AnimatePresence>
      {open && (
        <PopoverPrimitive.Portal forceMount>
          <PopoverPrimitive.Content asChild forceMount align={align} sideOffset={sideOffset} collisionPadding={12} {...rest}>
            <motion.div
              style={{ transformOrigin: 'var(--radix-popover-content-transform-origin)' }}
              className={cn('z-50 w-[min(360px,calc(100vw-24px))] rounded-xl border border-border bg-surface shadow-lg outline-none', className)}
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: duration.fast } }}
              transition={spring.smooth}
            >
              {children}
            </motion.div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      )}
    </AnimatePresence>
  );
}
