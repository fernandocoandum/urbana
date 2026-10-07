'use client';

import { Check } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { CategoryIcon } from '@/components/ui/category-icon';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { CATEGORIAS } from '../categorias';

/** Passo 1: grade de categorias. Escolher uma avança sozinho (o pai cuida do atraso de 200ms). */
export function StepCategoria({ valor, onEscolher }: { valor: string; onEscolher: (categoria: string) => void }) {
  return (
    <div role="group" aria-label="Categoria" className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
      {CATEGORIAS.map((cat, i) => {
        const ativo = valor === cat;
        const ultimo = i === CATEGORIAS.length - 1;
        return (
          <button
            key={cat}
            type="button"
            data-cat={cat}
            aria-pressed={ativo}
            onClick={() => onEscolher(cat)}
            className={cn(
              'relative flex flex-col items-center gap-3 rounded-xl border-2 bg-surface px-3 py-6 text-center outline-none transition-[transform,box-shadow,border-color,background-color] duration-150 hover:-translate-y-px hover:border-border-strong hover:shadow-md focus-visible:ring-4 focus-visible:ring-primary/25 active:scale-[0.98]',
              ativo ? 'border-primary bg-primary-soft ring-4 ring-primary/10' : 'border-border',
              // a categoria "Outros" ocupa a última linha inteira em vez de ficar sozinha
              ultimo && 'col-span-2 sm:col-span-3',
            )}
          >
            <CategoryIcon categoria={cat} size="lg" />
            <span className="text-base font-semibold">{cat}</span>
            <AnimatePresence>
              {ativo && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={spring.bouncy}
                  className="absolute right-3 top-3 grid size-6 place-items-center rounded-full bg-primary text-primary-fg"
                >
                  <Check className="size-4" strokeWidth={3} aria-hidden />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        );
      })}
    </div>
  );
}
