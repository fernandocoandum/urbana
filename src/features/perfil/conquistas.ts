import { calcularNivel, type PerfilStats } from './nivel';

export type ConquistaIcone = 'flag' | 'eye' | 'check' | 'heart' | 'shield';

export interface Conquista {
  id: string;
  label: string;
  /** "Como ganhar" (tooltip das bloqueadas) */
  dica: string;
  icone: ConquistaIcone;
  conquistada: boolean;
}

/** Conquistas do morador, derivadas só das métricas do perfil. */
export function calcularConquistas(st: PerfilStats): Conquista[] {
  const oc = st.ocorrencias || 0;
  const res = st.resolvidas || 0;
  const apoios = st.apoiosDados || 0;
  return [
    { id: 'primeiro-registro', label: 'Primeiro registro', dica: 'Registre sua primeira ocorrência.', icone: 'flag', conquistada: oc >= 1 },
    { id: 'olho-vivo', label: 'Olho vivo', dica: 'Registre 5 ocorrências.', icone: 'eye', conquistada: oc >= 5 },
    { id: 'problema-resolvido', label: 'Problema resolvido', dica: 'Tenha uma ocorrência resolvida.', icone: 'check', conquistada: res >= 1 },
    { id: 'vizinho-solidario', label: 'Vizinho solidário', dica: 'Apoie 3 ocorrências de outros moradores.', icone: 'heart', conquistada: apoios >= 3 },
    { id: 'guardiao', label: 'Guardião', dica: 'Chegue ao nível Guardião do Urbana (150 pontos).', icone: 'shield', conquistada: calcularNivel(st).indice >= 3 },
  ];
}
