'use client';

// Recriado a partir do componente "animated-tabs" de @chetanverma16 (21st.dev, MIT):
// Radix Tabs + indicador motion com layoutId deslizando entre os gatilhos (spring snappy).
import { motion } from 'motion/react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { useId, useState, type ComponentType, type ReactNode } from 'react';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';

export interface TabItem {
  value: string;
  label: string;
  /** id do gatilho (útil para seletores estáveis nos testes e para aria-labelledby no painel). */
  id?: string;
  icon?: ComponentType<{ className?: string }>;
  /** Contagem/ badge opcional ao lado do rótulo. */
  count?: number;
}

interface Props {
  tabs: TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  variant?: 'pill' | 'underline';
  /** Ocupa a largura toda e distribui os gatilhos. */
  fullWidth?: boolean;
  className?: string;
  'aria-label'?: string;
  /** Painéis (AnimatedTabsPanel) renderizados dentro do Root. */
  children?: ReactNode;
}

export function AnimatedTabs({ tabs, value, defaultValue, onValueChange, variant = 'pill', fullWidth, className, children, ...rest }: Props) {
  const id = useId();
  const [inner, setInner] = useState(defaultValue ?? tabs[0]?.value ?? '');
  const current = value ?? inner;
  const change = (v: string) => {
    if (value === undefined) setInner(v);
    onValueChange?.(v);
  };
  const pill = variant === 'pill';

  return (
    <TabsPrimitive.Root value={current} onValueChange={change} className={className}>
      <TabsPrimitive.List
        aria-label={rest['aria-label']}
        className={cn(
          'relative inline-flex max-w-full items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          pill ? 'gap-1 rounded-full bg-surface-2 p-1' : 'gap-6 border-b border-border',
          fullWidth && 'flex w-full',
          fullWidth && !pill && 'gap-0',
        )}
      >
        {tabs.map((t) => {
          const active = current === t.value;
          const Icon = t.icon;
          return (
            <TabsPrimitive.Trigger
              key={t.value}
              value={t.value}
              id={t.id}
              className={cn(
                'relative flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-4 focus-visible:ring-primary/25',
                pill ? 'h-9 shrink-0 rounded-full px-3 sm:px-4' : 'h-12 shrink-0 px-1',
                fullWidth && 'flex-1',
                active ? 'text-fg' : 'text-fg-muted hover:text-fg',
              )}
            >
              {active && (
                <motion.span
                  layoutId={`tab-indicator-${id}`}
                  transition={spring.snappy}
                  aria-hidden
                  className={cn('absolute', pill ? 'inset-0 rounded-full bg-surface shadow-sm ring-1 ring-border/60' : 'inset-x-0 -bottom-px h-0.5 rounded-full bg-primary')}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                {Icon && <Icon className="size-4" />}
                {t.label}
                {t.count !== undefined && (
                  <span className={cn('tabular min-w-5 rounded-full px-1.5 text-center text-sm max-[420px]:hidden', active ? 'bg-primary-soft text-primary' : 'bg-border/60 text-fg-muted')}>{t.count}</span>
                )}
              </span>
            </TabsPrimitive.Trigger>
          );
        })}
      </TabsPrimitive.List>
      {children}
    </TabsPrimitive.Root>
  );
}

export function AnimatedTabsPanel({ value, className, children, labelledBy }: { value: string; className?: string; children: ReactNode; /** use o `id` do gatilho quando ele foi definido em TabItem */ labelledBy?: string }) {
  return (
    <TabsPrimitive.Content value={value} aria-labelledby={labelledBy} className={cn('outline-none', className)}>
      {children}
    </TabsPrimitive.Content>
  );
}
