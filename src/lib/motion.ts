import type { Transition } from 'motion/react';

// Sistema de movimento do Urbana (PLANO, etapa C). Tudo que anima importa daqui.
export const duration = { fast: 0.16, base: 0.24, slow: 0.36, page: 0.42 } as const;

export const ease = {
  easeOut: [0.16, 1, 0.3, 1],
  easeStd: [0.2, 0, 0, 1],
} as const;

export const spring = {
  /** indicador de abas, toggles */
  snappy: { type: 'spring', stiffness: 520, damping: 40, mass: 0.8 },
  /** cards, painéis, sheet */
  smooth: { type: 'spring', stiffness: 280, damping: 32 },
  /** entrada de página e hero */
  gentle: { type: 'spring', stiffness: 160, damping: 24 },
  /** só celebração e ticket */
  bouncy: { type: 'spring', stiffness: 420, damping: 16 },
} as const satisfies Record<string, Transition>;

/** Stagger de listas: 0,03s por item, no máximo 8 itens. */
export const STAGGER = 0.03;
export const MAX_STAGGER_ITEMS = 8;
export const staggerDelay = (i: number) => Math.min(i, MAX_STAGGER_ITEMS) * STAGGER;
