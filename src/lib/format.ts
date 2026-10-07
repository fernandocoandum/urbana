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
