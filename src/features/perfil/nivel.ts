// Port de `calcularNivelPerfil` do app legado (legacy/index.html). Os emojis viram chaves de ícone
// (o componente decide o ícone lucide), o resto da regra é idêntico.
export interface PerfilStats { ocorrencias?: number; resolvidas?: number; apoiosDados?: number }

export type NivelIcone = 'sprout' | 'building' | 'handshake' | 'shield';

export interface NivelDef { min: number; nome: string; icone: NivelIcone }

export const NIVEIS: readonly NivelDef[] = [
  { min: 0, nome: 'Cidadão iniciante', icone: 'sprout' },
  { min: 20, nome: 'Cidadão ativo', icone: 'building' },
  { min: 60, nome: 'Colaborador da cidade', icone: 'handshake' },
  { min: 150, nome: 'Guardião do Urbana', icone: 'shield' },
];

/** Pontos: ocorrência 10, resolvida +5, apoio dado +2. */
export const PONTOS = { ocorrencia: 10, resolvida: 5, apoio: 2 } as const;

export interface Nivel {
  pontos: number;
  /** posição em NIVEIS (0 a 3) */
  indice: number;
  nome: string;
  icone: NivelIcone;
  proximo: string | null;
  faltam: number;
  /** 4 a 100 (a barra nunca fica totalmente vazia, como no legado) */
  progresso: number;
}

export function calcularNivel(st: PerfilStats): Nivel {
  const pontos = (st.ocorrencias || 0) * PONTOS.ocorrencia + (st.resolvidas || 0) * PONTOS.resolvida + (st.apoiosDados || 0) * PONTOS.apoio;
  let i = 0;
  while (i + 1 < NIVEIS.length && pontos >= NIVEIS[i + 1]!.min) i++;
  const atual = NIVEIS[i]!;
  const prox = NIVEIS[i + 1];
  const progresso = prox ? Math.round(((pontos - atual.min) / (prox.min - atual.min)) * 100) : 100;
  return {
    pontos,
    indice: i,
    nome: atual.nome,
    icone: atual.icone,
    proximo: prox ? prox.nome : null,
    faltam: prox ? prox.min - pontos : 0,
    progresso: Math.max(4, Math.min(100, progresso)),
  };
}
