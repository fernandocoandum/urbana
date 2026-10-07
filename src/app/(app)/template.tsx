'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { spring } from '@/lib/motion';

/** Entrada de página: opacity 0→1, y 8→0, spring gentle (o template remonta a cada navegação). */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring.gentle}>
      {children}
    </motion.div>
  );
}
