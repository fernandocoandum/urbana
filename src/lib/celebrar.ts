'use client';

/** Confete curto ao resolver uma ocorrência. Pulado com reduced motion; a biblioteca carrega sob demanda. */
export function celebrar(): void {
  if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  import('canvas-confetti')
    .then(({ default: confetti }) => {
      const cores = ['#2563eb', '#60a5fa', '#7c3aed', '#16a34a', '#f59e0b'];
      confetti({ particleCount: 90, spread: 75, startVelocity: 34, gravity: 0.95, ticks: 200, scalar: 0.9, origin: { x: 0.5, y: 0.35 }, colors: cores, disableForReducedMotion: true });
    })
    .catch(() => { /* o confete é só enfeite */ });
}
