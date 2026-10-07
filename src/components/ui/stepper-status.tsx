'use client';

import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { STATUS_LISTA } from '@/features/ocorrencias/categorias';
import { ease, duration } from '@/lib/motion';
import { cn } from '@/lib/utils';

type Orientation = 'horizontal' | 'vertical' | 'auto';

/** Os 5 estágios da ocorrência com linha de progresso animada. `auto`: vertical no mobile, horizontal a partir de md. */
export function StepperStatus({ status, orientation = 'auto', className }: { status: string; orientation?: Orientation; className?: string }) {
  const atual = Math.max(0, (STATUS_LISTA as readonly string[]).indexOf(status));
  const progresso = atual / (STATUS_LISTA.length - 1);
  return (
    <div className={className} role="group" aria-label={`Andamento: ${status}`}>
      {orientation !== 'vertical' && (
        <div className={cn(orientation === 'auto' && 'hidden md:block')}>
          <Horizontal atual={atual} progresso={progresso} />
        </div>
      )}
      {orientation !== 'horizontal' && (
        <div className={cn(orientation === 'auto' && 'md:hidden')}>
          <Vertical atual={atual} progresso={progresso} />
        </div>
      )}
    </div>
  );
}

function Dot({ i, atual }: { i: number; atual: number }) {
  const feito = i < atual;
  const ativo = i === atual;
  return (
    <span
      className={cn(
        'relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2 text-sm font-semibold transition-colors duration-300',
        feito && 'border-primary bg-primary text-primary-fg',
        ativo && 'border-primary bg-surface text-primary ring-4 ring-primary/15',
        !feito && !ativo && 'border-border-strong bg-surface text-fg-subtle',
      )}
    >
      {feito ? <Check className="size-4" aria-hidden /> : i + 1}
    </span>
  );
}

function Horizontal({ atual, progresso }: { atual: number; progresso: number }) {
  const n = STATUS_LISTA.length;
  return (
    <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
      {/* trilho entre o centro do primeiro e o do último ponto */}
      <div aria-hidden className="absolute top-4 h-0.5 -translate-y-1/2 rounded-full bg-border" style={{ left: `${50 / n}%`, right: `${50 / n}%` }}>
        <motion.div
          className="h-full origin-left rounded-full bg-primary"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: progresso }}
          transition={{ duration: duration.page, ease: ease.easeOut, delay: 0.1 }}
        />
      </div>
      {STATUS_LISTA.map((s, i) => (
        <li key={s} aria-current={i === atual ? 'step' : undefined} className="flex flex-col items-center gap-3 text-center">
          <Dot i={i} atual={atual} />
          <span className={cn('px-1 text-sm', i === atual ? 'font-semibold text-fg' : 'font-medium text-fg-muted')}>{s}</span>
        </li>
      ))}
    </ol>
  );
}

function Vertical({ atual, progresso }: { atual: number; progresso: number }) {
  const n = STATUS_LISTA.length;
  return (
    <ol className="relative flex flex-col gap-6">
      <div aria-hidden className="absolute left-4 w-0.5 -translate-x-1/2 rounded-full bg-border" style={{ top: 16, bottom: 16 }}>
        <motion.div
          className="h-full w-full origin-top rounded-full bg-primary"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: progresso }}
          transition={{ duration: duration.page, ease: ease.easeOut, delay: 0.1 }}
        />
      </div>
      {STATUS_LISTA.map((s, i) => (
        <li key={s} aria-current={i === atual ? 'step' : undefined} className="flex items-center gap-4">
          <Dot i={i} atual={atual} />
          <span className={cn('text-base', i === atual ? 'font-semibold text-fg' : 'font-medium text-fg-muted')}>
            {s}
            {i === atual && <span className="sr-only"> (etapa atual)</span>}
          </span>
        </li>
      ))}
      <span className="sr-only">{n} etapas</span>
    </ol>
  );
}
