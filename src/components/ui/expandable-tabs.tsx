'use client';

// Recriado a partir do componente "expandable-tabs" de @victorwelander (21st.dev, MIT): barra de
// ícones em que o item ativo expande largura e rótulo (AnimatePresence + width:auto).
//  - mode="ephemeral": clique seleciona; clicar fora (usehooks-ts) recolhe.
//  - mode="nav": cada item é um link; o ativo vem de usePathname e não fecha.
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState, type ComponentType, type ReactNode } from 'react';
import { useOnClickOutside } from 'usehooks-ts';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';

export interface ExpandableTab {
  title: string;
  icon: ComponentType<{ className?: string }>;
  /** Obrigatório no modo nav. */
  href?: string;
  /** Casa o pathname por prefixo (padrão: igual, ou prefixo se href != '/'). */
  match?: (pathname: string) => boolean;
  type?: undefined;
}
export type ExpandableItem = ExpandableTab | { type: 'separator' } | { type: 'custom'; node: ReactNode };

interface Props {
  tabs: ExpandableItem[];
  mode?: 'ephemeral' | 'nav';
  onChange?: (index: number | null) => void;
  className?: string;
  'aria-label'?: string;
}

const labelMotion = {
  initial: { width: 0, opacity: 0 },
  animate: { width: 'auto', opacity: 1 },
  exit: { width: 0, opacity: 0 },
  transition: spring.snappy,
};

function isActive(tab: ExpandableTab, pathname: string) {
  if (tab.match) return tab.match(pathname);
  if (!tab.href) return false;
  return pathname === tab.href || (tab.href !== '/' && pathname.startsWith(tab.href + '/'));
}

export function ExpandableTabs({ tabs, mode = 'ephemeral', onChange, className, ...rest }: Props) {
  const pathname = usePathname();
  const [selected, setSelected] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null) as React.RefObject<HTMLElement>;

  useOnClickOutside(ref, () => {
    if (mode === 'ephemeral' && selected !== null) {
      setSelected(null);
      onChange?.(null);
    }
  });

  return (
    <nav
      ref={ref as React.RefObject<HTMLElement>}
      aria-label={rest['aria-label'] ?? 'Navegação'}
      className={cn('flex w-fit items-center gap-1 rounded-2xl border border-border bg-surface p-1 shadow-xs', className)}
    >
      {tabs.map((tab, index) => {
        if (tab.type === 'separator') return <span key={`sep-${index}`} aria-hidden className="mx-1 h-6 w-px bg-border" />;
        if (tab.type === 'custom') return <span key={`custom-${index}`} className="flex items-center">{tab.node}</span>;

        const Icon = tab.icon;
        const open = mode === 'nav' ? isActive(tab, pathname) : selected === index;
        const classes = cn(
          'relative flex h-11 items-center rounded-xl text-sm font-medium outline-none transition-[background-color,color,padding] duration-150 focus-visible:ring-4 focus-visible:ring-primary/25',
          open ? 'bg-primary-soft px-4 text-primary' : 'px-3 text-fg-muted hover:bg-surface-2 hover:text-fg',
        );
        const inner = (
          <>
            <Icon className="size-5 shrink-0" />
            <AnimatePresence initial={false}>
              {open && (
                <motion.span {...labelMotion} className="overflow-hidden whitespace-nowrap">
                  <span className="pl-2">{tab.title}</span>
                </motion.span>
              )}
            </AnimatePresence>
          </>
        );

        if (mode === 'nav' && tab.href) {
          return (
            <Link key={tab.title} href={tab.href} aria-current={open ? 'page' : undefined} aria-label={tab.title} className={classes}>
              {inner}
            </Link>
          );
        }
        return (
          <button
            key={tab.title}
            type="button"
            aria-pressed={open}
            aria-label={tab.title}
            className={classes}
            onClick={() => {
              const next = selected === index ? null : index;
              setSelected(next);
              onChange?.(next);
            }}
          >
            {inner}
          </button>
        );
      })}
    </nav>
  );
}
