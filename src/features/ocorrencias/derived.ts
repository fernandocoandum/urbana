import type { Ocorrencia, OcorrenciaDerivada } from '@/lib/db/types';

// Campos derivados (não armazenados): atraso e uma pontuação simples de criticidade, usados
// pela fila de atendimento administrativa para ordenar além da contagem de apoios.
// `agora` é injetável para os testes serem determinísticos.
export function computeDerivedFields(o: Ocorrencia, agora: number = Date.now()): OcorrenciaDerivada {
  const prazoTs = o.prazo ? new Date(o.prazo).getTime() : null;
  const atrasada = !!(prazoTs && o.status !== 'Resolvida' && agora > prazoTs);
  const diasAberto = Math.max(0, Math.floor((agora - new Date(o.criadoEm).getTime()) / 86400000));
  const apoiosCount = (o.apoios || []).length;
  const criticidade = apoiosCount * 3 + Math.min(diasAberto, 30) + (atrasada ? 15 : 0);
  return { ...o, atrasada, diasAberto, criticidade };
}
