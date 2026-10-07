'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import { createContext, useContext, type ReactNode } from 'react';
import { duration, spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { useOpenState } from './use-open';

const OpenContext = createContext(false);

interface RootProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export function Dialog({ open, defaultOpen, onOpenChange, children }: RootProps) {
  const [current, set] = useOpenState(open, defaultOpen, onOpenChange);
  return (
    <OpenContext.Provider value={current}>
      <DialogPrimitive.Root open={current} onOpenChange={set}>
        {children}
      </DialogPrimitive.Root>
    </OpenContext.Provider>
  );
}

export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

interface ContentProps {
  /** Título acessível (obrigatório). Use `hideTitle` para ocultar visualmente. */
  title: string;
  description?: string;
  hideTitle?: boolean;
  /** false = não fecha com Esc nem clicando fora (ex.: termos de uso). */
  dismissible?: boolean;
  /** Mostra o X no canto. Padrão: igual a `dismissible`. */
  showClose?: boolean;
  className?: string;
  children?: ReactNode;
  footer?: ReactNode;
  /** Rodapé numa barra fixa abaixo da área rolável (textos longos, como os termos de uso). */
  stickyFooter?: boolean;
  /** id do elemento do diálogo (seletor estável nos testes). */
  id?: string;
  /** Sem padding: o conteúdo vai até as bordas (ex.: cartão de perfil com banner). Implica título oculto. */
  bare?: boolean;
}

export function DialogContent({ title, description, hideTitle, dismissible = true, showClose, className, children, footer, stickyFooter, id, bare }: ContentProps) {
  const open = useContext(OpenContext);
  const close = showClose ?? dismissible;
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
          <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
            <DialogPrimitive.Content
              asChild
              forceMount
              onEscapeKeyDown={dismissible ? undefined : (e) => e.preventDefault()}
              onPointerDownOutside={dismissible ? undefined : (e) => e.preventDefault()}
              onInteractOutside={dismissible ? undefined : (e) => e.preventDefault()}
            >
              <motion.div
                id={id}
                className={cn(
                  'pointer-events-auto relative flex max-h-[calc(100dvh-2rem)] w-full max-w-[480px] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-lg',
                  className,
                )}
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 6, transition: { duration: duration.fast } }}
                transition={spring.smooth}
              >
                <div className={cn('overflow-y-auto', !bare && 'p-6 sm:p-8')}>
                  <div className={cn('flex flex-col gap-1', (hideTitle || bare) && 'sr-only')}>
                    <DialogPrimitive.Title className="pr-8 text-2xl font-semibold tracking-[-.01em]">{title}</DialogPrimitive.Title>
                    {description ? (
                      <DialogPrimitive.Description className="text-base text-fg-muted">{description}</DialogPrimitive.Description>
                    ) : (
                      <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
                    )}
                  </div>
                  <div className={cn(!hideTitle && !bare && 'mt-6')}>{children}</div>
                  {footer && !stickyFooter && <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">{footer}</div>}
                </div>
                {footer && stickyFooter && (
                  <div className="flex flex-col-reverse gap-3 border-t border-border px-6 py-4 sm:flex-row sm:justify-end sm:px-8">{footer}</div>
                )}
                {close && (
                  <DialogPrimitive.Close
                    aria-label="Fechar"
                    className={cn('absolute right-4 top-4 grid size-11 place-items-center rounded-full text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg', bare && 'bg-surface/70 text-fg backdrop-blur')}
                  >
                    <X className="size-5" />
                  </DialogPrimitive.Close>
                )}
              </motion.div>
            </DialogPrimitive.Content>
          </div>
        </DialogPrimitive.Portal>
      )}
    </AnimatePresence>
  );
}
