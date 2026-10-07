'use client';

import { motion, useReducedMotion } from 'motion/react';

/* Fundo decorativo da tela de entrada: um "mapa" estilizado da cidade (ruas, rio e
   quarteirões) com pins de ocorrência flutuando, para a área fora do cartão não ficar vazia.
   Puramente visual (aria-hidden), atrás do cartão. */

const RUAS = [
  'M-50 180 C 300 150, 520 230, 900 190 S 1500 120, 2000 170',
  'M-50 520 C 260 560, 640 470, 980 520 S 1600 600, 2000 540',
  'M-50 860 C 400 820, 760 900, 1180 850 S 1700 800, 2000 880',
  'M220 -50 C 250 300, 170 600, 240 1150',
  'M620 -50 C 580 260, 690 640, 610 1150',
  'M1320 -50 C 1360 300, 1270 620, 1340 1150',
  'M1720 -50 C 1680 340, 1760 700, 1700 1150',
];
const RIO = 'M-50 700 C 320 640, 520 760, 860 690 S 1400 600, 1700 690 S 1950 760, 2050 720';
const QUARTEIROES = [
  [260, 220, 300, 250],
  [660, 230, 600, 240],
  [1370, 210, 300, 260],
  [270, 560, 290, 230],
  [1380, 570, 280, 230],
];

// posições em % da tela; ficam nas bordas, fora do cartão central
const PINS = [
  { x: 8, y: 18, cor: 'var(--cat-pavimentacao)', d: 0 },
  { x: 16, y: 72, cor: 'var(--cat-drenagem)', d: 0.6 },
  { x: 5, y: 46, cor: 'var(--cat-limpeza)', d: 1.2 },
  { x: 90, y: 14, cor: 'var(--cat-iluminacao)', d: 0.3 },
  { x: 94, y: 52, cor: 'var(--cat-parques)', d: 0.9 },
  { x: 90, y: 90, cor: 'var(--cat-sinalizacao)', d: 1.5 },
  { x: 48, y: 6, cor: 'var(--primary)', d: 0.45 },
  { x: 54, y: 93, cor: 'var(--cat-limpeza)', d: 1.05 },
];

export function AuthBackdrop() {
  const reduzido = useReducedMotion();

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
      <svg
        className="absolute inset-0 size-full text-primary"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="auth-fade" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="55%" stopColor="white" stopOpacity="1" />
          </radialGradient>
          <mask id="auth-mask">
            <rect width="1920" height="1080" fill="url(#auth-fade)" />
          </mask>
        </defs>
        <g mask="url(#auth-mask)">
          {QUARTEIROES.map(([x, y, w, h], i) => (
            <rect key={i} x={x} y={y} width={w} height={h} rx={28} fill="currentColor" opacity={0.05} />
          ))}
          <path d={RIO} fill="none" stroke="#14b8a6" strokeOpacity={0.22} strokeWidth={34} strokeLinecap="round" />
          {RUAS.map((d, i) => (
            <motion.path
              key={d}
              d={d}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.16}
              strokeWidth={i < 3 ? 14 : 10}
              strokeLinecap="round"
              initial={reduzido ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            />
          ))}
        </g>
      </svg>

      {PINS.map((p, i) => (
        <motion.div
          key={i}
          className="absolute max-[869px]:hidden"
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
          initial={reduzido ? false : { opacity: 0, y: -10 }}
          animate={reduzido ? { opacity: 1 } : { opacity: 1, y: [0, -6, 0] }}
          transition={
            reduzido
              ? { duration: 0 }
              : {
                  opacity: { duration: 0.4, delay: 0.5 + p.d * 0.3 },
                  y: { duration: 4 + (i % 3), delay: 0.5 + p.d, repeat: Infinity, ease: 'easeInOut' },
                }
          }
        >
          <span
            className="relative grid size-9 place-items-center rounded-full rounded-br-none rotate-45 shadow-md ring-4 ring-white/60 dark:ring-white/10"
            style={{ background: p.cor }}
          >
            <span className="size-3 -rotate-45 rounded-full bg-white" />
          </span>
        </motion.div>
      ))}
    </div>
  );
}
