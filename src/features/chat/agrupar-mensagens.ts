import { TZ_BR } from '@/lib/format';

/** Mensagens consecutivas do mesmo autor com menos de 5 min entre si formam um grupo. */
export const JANELA_GRUPO_MS = 5 * 60 * 1000;

export interface MsgBase { id: string; autor: string; data: string }

export interface Grupo<T extends MsgBase> {
  autor: string;
  mensagens: T[];
}

export interface Dia<T extends MsgBase> {
  /** AAAA-MM-DD no fuso de São Paulo */
  chave: string;
  /** "Hoje", "Ontem" ou "12 de outubro" (com o ano quando não é o atual) */
  rotulo: string;
  grupos: Grupo<T>[];
}

const fmtChave = new Intl.DateTimeFormat('en-CA', { timeZone: TZ_BR, year: 'numeric', month: '2-digit', day: '2-digit' });

export function chaveDoDia(data: string | number | Date): string {
  return fmtChave.format(new Date(data));
}

function diasEntre(a: string, b: string): number {
  const t = (k: string) => Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, Number(k.slice(8, 10)));
  return Math.round((t(a) - t(b)) / 86_400_000);
}

export function rotuloDoDia(chave: string, agora: Date = new Date()): string {
  const hoje = chaveDoDia(agora);
  const dif = diasEntre(hoje, chave);
  if (dif === 0) return 'Hoje';
  if (dif === 1) return 'Ontem';
  const mesmoAno = chave.slice(0, 4) === hoje.slice(0, 4);
  // meio-dia UTC evita virar o dia ao formatar no fuso local
  const d = new Date(`${chave}T12:00:00Z`);
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: 'numeric', month: 'long', ...(mesmoAno ? {} : { year: 'numeric' }) }).format(d);
}

/** Agrupa por dia (fuso de São Paulo) e, dentro do dia, por autor com intervalo < 5 min. Mantém a ordem recebida. */
export function agruparMensagens<T extends MsgBase>(mensagens: T[], agora: Date = new Date()): Dia<T>[] {
  const dias: Dia<T>[] = [];
  let ultima: T | null = null;
  for (const m of mensagens) {
    const chave = chaveDoDia(m.data);
    let dia = dias[dias.length - 1];
    if (!dia || dia.chave !== chave) {
      dia = { chave, rotulo: rotuloDoDia(chave, agora), grupos: [] };
      dias.push(dia);
      ultima = null;
    }
    const grupo = dia.grupos[dia.grupos.length - 1];
    const continua = grupo && ultima && grupo.autor === m.autor && new Date(m.data).getTime() - new Date(ultima.data).getTime() < JANELA_GRUPO_MS;
    if (continua) grupo.mensagens.push(m);
    else dia.grupos.push({ autor: m.autor, mensagens: [m] });
    ultima = m;
  }
  return dias;
}
