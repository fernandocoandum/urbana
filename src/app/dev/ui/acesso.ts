/**
 * Quem pode ver a vitrine /dev/ui. Em produção na Vercel (VERCEL_ENV=production) NUNCA, nem com
 * URBANA_DEV_UI=1. Fora disso: sempre em `next dev`; com `next start` só se URBANA_DEV_UI=1
 * (para conferir o visual e tirar screenshots localmente).
 */
export function vitrineLiberada(e: { NODE_ENV?: string; VERCEL_ENV?: string; URBANA_DEV_UI?: string }): boolean {
  if (e.VERCEL_ENV === 'production') return false;
  return e.NODE_ENV !== 'production' || e.URBANA_DEV_UI === '1';
}
