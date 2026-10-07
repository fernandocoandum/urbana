'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { createContext, useContext, type ReactNode } from 'react';
import { duration, spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { useOpenState } from './use-open';

const OpenContext = createContext(false);

export function Sheet({ open, defaultOpen, onOpenChange, children }: { open?: boolean; defaultOpen?: boolean; onOpenChange?: (o: boolean) => void; children: ReactNode }) {
  const [current, set] = useOpenState(open, defaultOpen, onOpenChange);
  return (
    <OpenContext.Provider value={current}>
      <DialogPrimitive.Root open={current} onOpenChange={set}>
        {children}
      </DialogPrimitive.Root>
    </OpenContext.Provider>
  );
}
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

type Side = 'left' | 'right' | 'bottom';

const sideClass: Record<Side, string> = {
  left: 'inset-y-0 left-0 w-[min(320px,88vw)] rounded-r-2xl border-r',
  right: 'inset-y-0 right-0 w-[min(400px,92vw)] rounded-l-2xl border-l',
  bottom: 'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl border-t',
};
const hidden: Record<Side, { x?: string; y?: string }> = {
  left: { x: '-100%' },
  right: { x: '100%' },
  bottom: { y: '100%' },
};

interface ContentProps {
  title: string;
  description?: string;
  hideTitle?: boolean;
  side?: Side;
  className?: string;
  children?: ReactNode;
}

/** Painel lateral ou inferior (Dialog do Radix). No `bottom` aparece o handle de arrastar visual. */
export function SheetContent({ title, description, hideTitle, side = 'right', className, children }: ContentProps) {
  const open = useContext(OpenContext);
  return (
    <AnimatePresence>
      {open && (
        <DialogPrimitive.Portal forceMount>
          <DialogPrimitive.Overlay asChild forceMount>
            <motion.div
              className="fixed inset-0 z-50 bg-fg/40 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration.base }}
            />
          </DialogPrimitive.Overlay>
          <DialogPrimitive.Content asChild forceMount>
            <motion.div
              className={cn('fixed z-50 flex flex-col border-border bg-surface shadow-lg pb-safe', sideClass[side], className)}
              initial={hidden[side]}
              animate={{ x: 0, y: 0 }}
              exit={{ ...hidden[side], transition: { duration: duration.base, ease: [0.2, 0, 0, 1] } }}
              transition={spring.smooth}
            >
              {side === 'bottom' && <div aria-hidden className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-border-strong" />}
              <div className={cn('flex items-start justify-between gap-4 px-6 pt-5', hideTitle && 'sr-only')}>
                <div>
                  <DialogPrimitive.Title className="text-xl font-semibold">{title}</DialogPrimitive.Title>
                  {description ? (
                    <DialogPrimitive.Description className="mt-1 text-sm text-fg-muted">{description}</DialogPrimitive.Description>
                  ) : (
                    <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
                  )}
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
              <DialogPrimitive.Close
                aria-label="Fechar"
                className="absolute right-3 top-3 grid size-11 place-items-center rounded-full text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <X className="size-5" />
              </DialogPrimitive.Close>
            </motion.div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      )}
    </AnimatePresence>
  );
}
