'use client';

// Recriado a partir do componente "menu" de @lavikatiyar (21st.dev, MIT): dropdown com conteúdo
// animado (scale .96→1, opacity, origem no gatilho) e itens entrando em stagger.
import { AnimatePresence, motion, type Variants } from 'motion/react';
import { DropdownMenu } from 'radix-ui';
import { Check } from 'lucide-react';
import { createContext, useContext, type ComponentType, type ReactNode } from 'react';
import { duration, spring, STAGGER } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { useOpenState } from './use-open';

const OpenContext = createContext(false);

export function Menu({ open, defaultOpen, onOpenChange, children }: { open?: boolean; defaultOpen?: boolean; onOpenChange?: (o: boolean) => void; children: ReactNode }) {
  const [current, set] = useOpenState(open, defaultOpen, onOpenChange);
  return (
    <OpenContext.Provider value={current}>
      <DropdownMenu.Root open={current} onOpenChange={set} modal={false}>
        {children}
      </DropdownMenu.Root>
    </OpenContext.Provider>
  );
}
export const MenuTrigger = DropdownMenu.Trigger;

const content: Variants = {
  closed: { opacity: 0, scale: 0.96, y: -4, transition: { duration: duration.fast } },
  open: { opacity: 1, scale: 1, y: 0, transition: { ...spring.smooth, staggerChildren: STAGGER, delayChildren: 0.02 } },
};
const item: Variants = {
  closed: { opacity: 0, y: -4 },
  open: { opacity: 1, y: 0, transition: { duration: duration.base, ease: [0.16, 1, 0.3, 1] } },
};

export function MenuContent({ className, align = 'end', sideOffset = 10, children }: { className?: string; align?: 'start' | 'center' | 'end'; sideOffset?: number; children?: ReactNode }) {
  const open = useContext(OpenContext);
  return (
    <AnimatePresence>
      {open && (
        <DropdownMenu.Portal forceMount>
          <DropdownMenu.Content asChild forceMount align={align} sideOffset={sideOffset} collisionPadding={12}>
            <motion.div
              variants={content}
              initial="closed"
              animate="open"
              exit="closed"
              style={{ transformOrigin: 'var(--radix-dropdown-menu-content-transform-origin)' }}
              className={cn('z-50 min-w-[220px] max-w-[min(320px,calc(100vw-24px))] rounded-xl border border-border bg-surface p-2 shadow-lg outline-none', className)}
            >
              {children}
            </motion.div>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      )}
    </AnimatePresence>
  );
}

interface ItemProps {
  icon?: ComponentType<{ className?: string }>;
  onSelect?: (e: Event) => void;
  danger?: boolean;
  checked?: boolean;
  disabled?: boolean;
  /** Mantém o menu aberto ao selecionar (ex.: alternar tema). */
  keepOpen?: boolean;
  className?: string;
  children: ReactNode;
}

export function MenuItem({ icon: Icon, onSelect, danger, checked, disabled, keepOpen, className, children }: ItemProps) {
  return (
    <DropdownMenu.Item
      asChild
      disabled={disabled}
      onSelect={(e) => {
        if (keepOpen) e.preventDefault();
        onSelect?.(e);
      }}
    >
      <motion.div
        variants={item}
        className={cn(
          'flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-lg px-3 text-base outline-none transition-colors',
          'data-[highlighted]:bg-surface-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
          danger ? 'text-danger data-[highlighted]:bg-danger-soft' : 'text-fg',
          className,
        )}
      >
        {Icon && <Icon className={cn('size-5 shrink-0', danger ? 'text-danger' : 'text-fg-muted')} />}
        <span className="flex-1 truncate">{children}</span>
        {checked && <Check className="size-4 text-primary" />}
      </motion.div>
    </DropdownMenu.Item>
  );
}

export function MenuLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={item} className={cn('px-3 py-2', className)}>
      {children}
    </motion.div>
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="-mx-2 my-2 h-px bg-border" />;
}
