'use client';

import { motion } from 'motion/react';
import { useId } from 'react';
import { useAppNativo } from '@/lib/app-nativo';
import { cn } from '@/lib/utils';

export type HumorUrbaninha = 'feliz' | 'pensando' | 'acenando';

// Cores fixas (não seguem o tema) para o mascote ter a mesma cara no claro e no escuro.
const COR = {
  corpoClaro: '#5b8cff',
  corpoEscuro: '#1d4fc9',
  rosto: '#f5f8ff',
  olho: '#0f172a',
  bochecha: '#ff8fa3',
  luz: '#ffc93c',
} as const;

const origemCentro = { transformBox: 'fill-box', transformOrigin: 'center' } as const;

/**
 * Mascote da Urbaninha: um pin de mapa com rosto e uma antena de "sinal" (eco do símbolo do Urbana).
 * `animado` liga piscar, flutuar e o brilho da antena; o MotionConfig global já respeita reduced-motion.
 */
export function UrbaninhaMascote({ humor = 'feliz', animado: animadoProp = true, className }: { humor?: HumorUrbaninha; animado?: boolean; className?: string }) {
  const id = useId();
  // No app Android o WebView engasga com animações em loop: o mascote fica parado.
  const app = useAppNativo();
  const animado = animadoProp && !app;
  const corpo = `${id}-corpo`;
  const pensando = humor === 'pensando';

  return (
    <motion.svg
      viewBox="0 0 64 72"
      aria-hidden
      className={cn('overflow-visible', className)}
      animate={animado ? { y: [0, -2, 0] } : undefined}
      transition={animado ? { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } : undefined}
    >
      <defs>
        <linearGradient id={corpo} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={COR.corpoClaro} />
          <stop offset="1" stopColor={COR.corpoEscuro} />
        </linearGradient>
      </defs>

      {/* antena com a luz de "sinal" */}
      <path d="M32 17V9.5" stroke={COR.corpoEscuro} strokeWidth={3} strokeLinecap="round" />
      {animado && (
        <motion.circle
          cx={32} cy={7} r={4} fill={COR.luz} style={origemCentro}
          animate={{ scale: [1, pensando ? 2.6 : 2.1], opacity: [0.55, 0] }}
          transition={{ duration: pensando ? 0.9 : 2.4, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      <circle cx={32} cy={7} r={4} fill={COR.luz} />

      {/* mãozinha (acena na boas-vindas) */}
      <motion.ellipse
        cx={54.5} cy={44} rx={4.6} ry={4.2} fill={COR.corpoEscuro}
        style={{ transformBox: 'view-box', transformOrigin: '50px 48px' }}
        animate={animado && humor === 'acenando' ? { rotate: [0, -28, 6, -28, 0] } : { rotate: 0 }}
        transition={{ duration: 1.4, repeat: animado && humor === 'acenando' ? Infinity : 0, repeatDelay: 1.2 }}
      />

      {/* corpo em forma de pin */}
      <path d="M32 70C25 61 12 50 12 36a20 20 0 0 1 40 0c0 14-13 25-20 34Z" fill={`url(#${corpo})`} />
      <ellipse cx={22} cy={23} rx={5} ry={3} fill="#fff" opacity={0.28} transform="rotate(-30 22 23)" />

      {/* rosto */}
      <ellipse cx={32} cy={37.5} rx={14.5} ry={12} fill={COR.rosto} />
      <motion.g
        style={origemCentro}
        animate={animado ? { scaleY: [1, 1, 0.12, 1] } : undefined}
        transition={animado ? { duration: 4.2, times: [0, 0.9, 0.95, 1], repeat: Infinity } : undefined}
      >
        {[26.5, 37.5].map((x) => (
          <g key={x} transform={pensando ? 'translate(1.2 -1.4)' : undefined}>
            <ellipse cx={x} cy={36} rx={2.3} ry={3} fill={COR.olho} />
            <circle cx={x + 0.8} cy={34.9} r={0.8} fill="#fff" />
          </g>
        ))}
      </motion.g>
      <ellipse cx={22.2} cy={41.5} rx={2.4} ry={1.6} fill={COR.bochecha} opacity={0.75} />
      <ellipse cx={41.8} cy={41.5} rx={2.4} ry={1.6} fill={COR.bochecha} opacity={0.75} />
      {pensando
        ? <circle cx={33.5} cy={43} r={1.5} fill={COR.olho} />
        : <path d="M28.5 41.6Q32 45.2 35.5 41.6" stroke={COR.olho} strokeWidth={1.8} strokeLinecap="round" fill="none" />}
    </motion.svg>
  );
}
