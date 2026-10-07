import { TZ_BR } from '@/lib/format';

export interface Barra { x: number; w: number }

/**
 * Barras decorativas do ticket (port do componente original): 60 barras, largura 1.5 ou 2.5 a
 * partir de um hash do protocolo, centralizadas numa área de 250 de largura.
 */
export function gerarBarras(protocolo: string, largura = 250): Barra[] {
  const hash = (str: string) => str.split('').reduce((a, c) => { a = ((a << 5) - a) + c.charCodeAt(0); return a & a; }, 0);
  const rnd = (n: number) => { const x = Math.sin(n) * 10000; return x - Math.floor(x); };
  const seed = hash(protocolo);
  const larguras = Array.from({ length: 60 }, (_, i) => (rnd(seed + i) > 0.7 ? 2.5 : 1.5));
  const total = larguras.reduce((a, w) => a + w + 1.5, 0) - 1.5;
  let x = (largura - total) / 2;
  return larguras.map((w) => { const b = { x: Number(x.toFixed(2)), w }; x += w + 1.5; return b; });
}

/** "7 out 2026 • 14:30" (mesmo formato do legado, no fuso de Braço do Norte). */
export function formatarDataTicket(data: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TZ_BR, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
    .format(data)
    .replace(',', ' •')
    .replace(/\s+de\s+/g, ' ')
    .replace('.', '');
}
