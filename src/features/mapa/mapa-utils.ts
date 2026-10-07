// Constantes do mapa (copiadas do app legado). Cores são constantes: os ícones do Leaflet são
// montados com nós DOM, nunca com HTML vindo de dados.
export const CENTRO_CIDADE: [number, number] = [-28.2761, -49.1712];

export const BAIRRO_CENTROS: Record<string, [number, number]> = {
  'Centro': [-28.2761, -49.1712],
  'Pinheiral': [-28.265, -49.158],
  'Baixo Pinheiral': [-28.27, -49.152],
  'São Maurício': [-28.29, -49.18],
  'Rio Glória': [-28.255, -49.19],
  'Santa Clara': [-28.282, -49.165],
  'Outro': [-28.2761, -49.1712],
};

export const MAPA_COR_STATUS: Record<string, string> = {
  'Recebida': '#94a3b8',
  'Em análise': '#f59e0b',
  'Encaminhada': '#8b5cf6',
  'Em atendimento': '#3b82f6',
  'Resolvida': '#22c55e',
};
export const COR_PIN_PADRAO = '#2563eb';

export function centroDoBairro(bairro: string | null | undefined): [number, number] {
  return (bairro && BAIRRO_CENTROS[bairro]) || CENTRO_CIDADE;
}

/** Ponto devolvido por `/api/mapa`. */
export interface PontoMapa {
  id: string;
  protocolo: string;
  titulo: string;
  categoria: string;
  status: string;
  bairro: string;
  lat: number | null;
  lng: number | null;
  apoios: number;
  apoiado: boolean;
  isMine: boolean;
  nomeUsuario: string | null;
  precisaoLocal: string;
  criadoEm?: string;
  /** Só vem para o admin (`/api/mapa`). */
  atrasada?: boolean;
  diasAberto?: number;
}

/** Deslocamento determinístico (±amount graus) a partir do id: pontos sem coordenada não se empilham. Port de `jitterFromId`. */
export function jitterFromId(id: string, amount: number): [number, number] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const a = (((h % 1000) / 1000) - 0.5) * 2 * amount;
  const b = ((((h >>> 3) % 1000) / 1000) - 0.5) * 2 * amount;
  return [a, b];
}

export interface PosicaoPonto { lat: number; lng: number; aproximado: boolean }

/**
 * Posição de um ponto. Sem coordenada real, usa o centro do bairro com jitter e marca como
 * aproximado: nunca fingimos uma precisão de GPS que não existe.
 */
export function posicaoDoPonto(p: Pick<PontoMapa, 'id' | 'bairro' | 'lat' | 'lng' | 'precisaoLocal'>): PosicaoPonto {
  const semCoord = p.lat == null || p.lng == null;
  const aproximado = semCoord || p.precisaoLocal === 'aproximado';
  if (p.lat != null && p.lng != null) return { lat: p.lat, lng: p.lng, aproximado };
  const [clat, clng] = centroDoBairro(p.bairro);
  const [ja, jb] = jitterFromId(p.id, 0.006);
  return { lat: clat + ja, lng: clng + jb, aproximado };
}

/** Peso de um ponto no mapa de calor: 0,4 base + 0,06 por apoio (até 10). */
export function pesoCalor(apoios: number): number {
  return 0.4 + Math.min(Math.max(apoios, 0), 10) * 0.06;
}

export interface FiltrosMapa {
  /** Vazio = todas as categorias. */
  categorias: readonly string[];
  /** 'todos' ou um status. */
  status: string;
  soMinhas: boolean;
  /** Só o admin: pontos com prazo vencido. */
  soAtrasadas: boolean;
}
export const FILTROS_PADRAO: FiltrosMapa = { categorias: [], status: 'todos', soMinhas: false, soAtrasadas: false };

export function filtrarPontos(pontos: readonly PontoMapa[], f: FiltrosMapa): PontoMapa[] {
  return pontos.filter(
    (p) =>
      (f.categorias.length === 0 || f.categorias.includes(p.categoria)) &&
      (f.status === 'todos' || p.status === f.status) &&
      (!f.soMinhas || p.isMine) &&
      (!f.soAtrasadas || p.atrasada === true),
  );
}

export interface BairroRank { bairro: string; total: number; centro: [number, number] }

/** Ranking dos bairros com mais ocorrências (empate: ordem alfabética). */
export function rankingBairros(pontos: readonly Pick<PontoMapa, 'bairro'>[], limite = 5): BairroRank[] {
  const cont = new Map<string, number>();
  for (const p of pontos) cont.set(p.bairro, (cont.get(p.bairro) ?? 0) + 1);
  return [...cont.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
    .slice(0, limite)
    .map(([bairro, total]) => ({ bairro, total, centro: centroDoBairro(bairro) }));
}

/** Diâmetro do círculo do cluster conforme a contagem: 36 / 44 / 52. */
export function tamanhoCluster(n: number): 36 | 44 | 52 {
  return n < 10 ? 36 : n < 50 ? 44 : 52;
}
