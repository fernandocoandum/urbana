// Adaptado de React Bits (https://reactbits.dev) — MIT + Commons Clause, © David Haz.
// O uso dentro de um app é permitido; não pode ser revendido como componente ou biblioteca.
// Adaptações do Urbana: lista genérica (renderItem em vez de strings), sem gradientes nem navegação
// por teclado (o popover de notificações já tem foco/teclado do Radix), cores do tema e reduced motion.
'use client';

import { motion, useInView, useReducedMotion } from 'motion/react';
import { useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

function AnimatedItem({ children, index }: { children: ReactNode; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const inView = useInView(ref, { amount: 0.3, once: true });
  return (
    <motion.div
      ref={ref}
      data-index={index}
      initial={reduced ? false : { scale: 0.92, opacity: 0 }}
      animate={inView || reduced ? { scale: 1, opacity: 1 } : { scale: 0.92, opacity: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index, 8) * 0.03 }}
    >
      {children}
    </motion.div>
  );
}

interface Props<T> {
  items: T[];
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  /** Altura máxima da área rolável. */
  maxHeight?: number;
}

export default function AnimatedList<T>({ items, getKey, renderItem, className, maxHeight = 400 }: Props<T>) {
  return (
    <div className={cn('overflow-y-auto overscroll-contain', className)} style={{ maxHeight }}>
      {items.map((item, i) => (
        <AnimatedItem key={getKey(item, i)} index={i}>
          {renderItem(item, i)}
        </AnimatedItem>
      ))}
    </div>
  );
}
