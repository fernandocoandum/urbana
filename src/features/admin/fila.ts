// Regras puras da fila de atendimento e da visão geral do admin (sem React, sem rede).
// A fila busca /api/ocorrencias uma vez e filtra/ordena no cliente: serve bem para centenas de itens.
import { BAIRROS, CATEGORIAS, STATUS_LISTA } from '@/features/ocorrencias/categorias';
import { pedidoPendente } from '@/features/ocorrencias/proxima-acao';
import type { OcorrenciaDerivada } from '@/lib/db/types';
import { TZ_BR } from '@/lib/format';

export const ORDENS = ['criticidade', 'recentes', 'antigas', 'apoios', 'prazo'] as const;
export type OrdemFila = (typeof ORDENS)[number];
export const ORDEM_ROTULO: Record<OrdemFila, string> = {
  criticidade: 'Mais críticas',
  recentes: 'Mais recentes',
  antigas: 'Mais antigas',
  apoios: 'Mais apoiadas',
  prazo: 'Prazo mais próximo',
};

export interface FiltrosFila {
  status: string;
  categoria: string;
  bairro: string;
  busca: string;
  soAtrasadas: boolean;
  soNaoLidas: boolean;
  comReabertura: boolean;
}
export const FILTROS_VAZIOS: FiltrosFila = { status: '', categoria: '', bairro: '', busca: '', soAtrasadas: false, soNaoLidas: false, comReabertura: false };

/** Minúsculas e sem acento, para a busca não depender de "ç" ou "ã". */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function filtrarFila(lista: OcorrenciaDerivada[], f: FiltrosFila): OcorrenciaDerivada[] {
  const termo = normalizar(f.busca);
  return lista.filter((o) => {
    if (f.status && o.status !== f.status) return false;
    if (f.categoria && o.categoria !== f.categoria) return false;
    if (f.bairro && o.bairro !== f.bairro) return false;
    if (f.soAtrasadas && !o.atrasada) return false;
    if (f.soNaoLidas && !o.naoLidoAdmin) return false;
    if (f.comReabertura && !pedidoPendente(o)) return false;
    if (termo) {
      const alvo = normalizar(`${o.protocolo} ${o.titulo} ${o.endereco} ${o.bairro} ${o.nomeUsuario ?? ''}`);
      if (!alvo.includes(termo)) return false;
    }
    return true;
  });
}

const ts = (v: string | Date | null | undefined) => (v ? new Date(v).getTime() : NaN);

/** Ordena sem alterar a lista original. Empates caem na mais recente primeiro. */
export function ordenarFila(lista: OcorrenciaDerivada[], chave: OrdemFila = 'criticidade'): OcorrenciaDerivada[] {
  const recente = (a: OcorrenciaDerivada, b: OcorrenciaDerivada) => ts(b.criadoEm) - ts(a.criadoEm);
  const cmp: Record<OrdemFila, (a: OcorrenciaDerivada, b: OcorrenciaDerivada) => number> = {
    criticidade: (a, b) => b.criticidade - a.criticidade || recente(a, b),
    recentes: recente,
    antigas: (a, b) => -recente(a, b),
    apoios: (a, b) => (b.apoios || []).length - (a.apoios || []).length || recente(a, b),
    // sem prazo vai para o fim; resolvidas também não têm o que cobrar
    prazo: (a, b) => {
      const pa = a.status === 'Resolvida' ? NaN : ts(a.prazo);
      const pb = b.status === 'Resolvida' ? NaN : ts(b.prazo);
      if (Number.isNaN(pa) && Number.isNaN(pb)) return recente(a, b);
      if (Number.isNaN(pa)) return 1;
      if (Number.isNaN(pb)) return -1;
      return pa - pb || recente(a, b);
    },
  };
  return [...lista].sort(cmp[chave] ?? cmp.criticidade);
}

// ------------------------------------------------------------------ filtros na URL

type ParamsLeitura = { get(nome: string): string | null };

/** Lê os filtros de `?status=&categoria=&bairro=&busca=&atrasadas=1&naolidas=1&reabertura=1&ordem=`. Valores inválidos viram vazio. */
export function filtrosDeSearchParams(sp: ParamsLeitura): { filtros: FiltrosFila; ordem: OrdemFila } {
  const status = sp.get('status') ?? '';
  const categoria = sp.get('categoria') ?? '';
  const bairro = sp.get('bairro') ?? '';
  const ordem = sp.get('ordem') ?? '';
  return {
    filtros: {
      status: (STATUS_LISTA as readonly string[]).includes(status) ? status : '',
      categoria: CATEGORIAS.includes(categoria) ? categoria : '',
      bairro: (BAIRROS as readonly string[]).includes(bairro) ? bairro : '',
      busca: (sp.get('busca') ?? '').slice(0, 80),
      soAtrasadas: sp.get('atrasadas') === '1',
      soNaoLidas: sp.get('naolidas') === '1',
      comReabertura: sp.get('reabertura') === '1',
    },
    ordem: (ORDENS as readonly string[]).includes(ordem) ? (ordem as OrdemFila) : 'criticidade',
  };
}

/** Inverso de `filtrosDeSearchParams`: só escreve o que difere do padrão (URL curta e compartilhável). */
export function searchParamsDeFiltros(f: FiltrosFila, ordem: OrdemFila = 'criticidade'): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.busca.trim()) sp.set('busca', f.busca.trim());
  if (f.status) sp.set('status', f.status);
  if (f.categoria) sp.set('categoria', f.categoria);
  if (f.bairro) sp.set('bairro', f.bairro);
  if (f.soAtrasadas) sp.set('atrasadas', '1');
  if (f.soNaoLidas) sp.set('naolidas', '1');
  if (f.comReabertura) sp.set('reabertura', '1');
  if (ordem !== 'criticidade') sp.set('ordem', ordem);
  return sp;
}

// ------------------------------------------------------------------ visão geral

export interface PontoSerie { dia: string; rotulo: string; criadas: number; resolvidas: number }
export interface ResumoOperacional {
  total: number;
  pendentes: number;
  emAtendimento: number;
  resolvidas: number;
  /** 0 a 100, inteiro. */
  taxaResolucao: number;
  atrasadas: number;
  naoLidas: number;
  comReabertura: number;
  /** Média em dias entre abrir e a última resolução; null sem nenhuma resolvida. */
  tempoMedioResolucaoDias: number | null;
  serie: PontoSerie[];
  categorias: { nome: string; total: number }[];
  bairros: { nome: string; total: number }[];
}

const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: TZ_BR, year: 'numeric', month: '2-digit', day: '2-digit' });
/** "2026-10-07" no fuso de Braço do Norte. */
export function diaBR(d: string | number | Date): string {
  return fmtDia.format(new Date(d));
}

/** Data da última vez que a ocorrência entrou em "Resolvida" (do histórico); só vale se está resolvida agora. */
export function dataResolucao(o: OcorrenciaDerivada): number | null {
  if (o.status !== 'Resolvida') return null;
  for (let i = (o.historico || []).length - 1; i >= 0; i--) {
    const h = o.historico[i]!;
    if (h.status === 'Resolvida') return ts(h.data);
  }
  return ts(o.atualizadoEm);
}

export function resumoOperacional(lista: OcorrenciaDerivada[], agora: number = Date.now(), dias = 30): ResumoOperacional {
  const resolvidas = lista.filter((o) => o.status === 'Resolvida');
  const duracoes = resolvidas
    .map((o) => {
      const fim = dataResolucao(o);
      return fim === null ? NaN : (fim - ts(o.criadoEm)) / 86400000;
    })
    .filter((d) => Number.isFinite(d) && d >= 0);

  const serieMapa = new Map<string, PontoSerie>();
  for (let i = dias - 1; i >= 0; i--) {
    const dia = diaBR(agora - i * 86400000);
    const [, mm, dd] = dia.split('-');
    serieMapa.set(dia, { dia, rotulo: `${dd}/${mm}`, criadas: 0, resolvidas: 0 });
  }
  for (const o of lista) {
    const c = serieMapa.get(diaBR(o.criadoEm));
    if (c) c.criadas++;
    const fim = dataResolucao(o);
    if (fim !== null && Number.isFinite(fim)) {
      const r = serieMapa.get(diaBR(fim));
      if (r) r.resolvidas++;
    }
  }

  const contar = (chave: (o: OcorrenciaDerivada) => string) => {
    const m = new Map<string, number>();
    for (const o of lista) m.set(chave(o), (m.get(chave(o)) ?? 0) + 1);
    return [...m.entries()].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
  };

  return {
    total: lista.length,
    pendentes: lista.length - resolvidas.length,
    emAtendimento: lista.filter((o) => o.status === 'Em atendimento').length,
    resolvidas: resolvidas.length,
    taxaResolucao: lista.length ? Math.round((resolvidas.length / lista.length) * 100) : 0,
    atrasadas: lista.filter((o) => o.atrasada).length,
    naoLidas: lista.filter((o) => o.naoLidoAdmin).length,
    comReabertura: lista.filter((o) => !!pedidoPendente(o)).length,
    tempoMedioResolucaoDias: duracoes.length ? duracoes.reduce((a, b) => a + b, 0) / duracoes.length : null,
    serie: [...serieMapa.values()],
    categorias: contar((o) => o.categoria),
    bairros: contar((o) => o.bairro),
  };
}
