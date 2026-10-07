'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * Anima a altura do contêiner quando o conteúdo muda (troca de abas, passos do wizard).
 * O padding de 8px com margem negativa evita que o overflow corte o anel de foco dos campos.
 */
export function AutoHeight({ children, className }: { children: ReactNode; className?: string }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | 'auto'>('auto');
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = inner.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <motion.div
      className={cn('-m-2 overflow-hidden p-2', className)}
      style={{ boxSizing: 'content-box' }}
      initial={false}
      animate={{ height }}
      transition={reduced ? { duration: 0 } : spring.smooth}
    >
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}
