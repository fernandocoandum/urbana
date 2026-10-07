// Formatação em pt-BR sempre no fuso de Braço do Norte.
export const TZ_BR = 'America/Sao_Paulo';

type Dateish = string | number | Date | null | undefined;

export function fmtDate(iso: Dateish): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: TZ_BR });
}

export function fmtDateTime(iso: Dateish): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('pt-BR', { timeZone: TZ_BR });
}

/** "Bom dia" / "Boa tarde" / "Boa noite" pelo horário de Braço do Norte. */
export function saudacaoPorHorario(agora: Date = new Date()): string {
  const hora = Number(new Intl.DateTimeFormat('pt-BR', { timeZone: TZ_BR, hour: 'numeric', hour12: false }).format(agora));
  if (hora < 5) return 'Boa noite';
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** "Quarta-feira, 7 de outubro". */
export function dataDeHojeExtenso(agora: Date = new Date()): string {
  const texto = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ_BR, weekday: 'long', day: 'numeric', month: 'long' }).format(agora);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Até duas iniciais maiúsculas ("Maria da Silva" → "MD"). Não escapa: o React já escapa. */
export function initials(nome: string | null | undefined): string {
  return (nome || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => Array.from(w)[0] ?? '')
    .join('')
    .toUpperCase() || '?';
}

/** "14:32" no fuso de Braço do Norte. */
export function fmtHora(iso: Dateish): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleTimeString('pt-BR', { timeZone: TZ_BR, hour: '2-digit', minute: '2-digit' });
}

/** "out. de 2026" — para "Membro desde". */
export function fmtMesAno(iso: Dateish): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: TZ_BR, month: 'short', year: 'numeric' });
}

/** "agora", "há 5 min", "há 3 h", "ontem", "há 4 dias" e, depois de uma semana, a data. */
export function tempoRelativo(iso: Dateish, agora: number = Date.now()): string {
  if (!iso) return '–';
  const ms = agora - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '–';
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ontem';
  if (d < 7) return `há ${d} dias`;
  return fmtDate(iso);
}
