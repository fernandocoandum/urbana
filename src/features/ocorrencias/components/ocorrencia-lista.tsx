'use client';

import { AnimatePresence, motion } from 'motion/react';
import { spring, staggerDelay } from '@/lib/motion';
import type { OcorrenciaDerivada } from '@/lib/db/types';
import { OcorrenciaRow } from './ocorrencia-row';

/** Lista de linhas com entrada em cascata (máx. 8 itens) e reacomodação suave ao filtrar. */
export function OcorrenciaLista({ itens }: { itens: OcorrenciaDerivada[] }) {
  return (
    <ul className="relative flex flex-col gap-3">
      <AnimatePresence initial mode="popLayout">
        {itens.map((o, i) => (
          <motion.li
            key={o.id}
            layout="position"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ ...spring.smooth, delay: staggerDelay(i) }}
          >
            <OcorrenciaRow o={o} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
