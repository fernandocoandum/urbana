// Validação da mudança de status, a mesma no cliente (antes do PUT) e no servidor (alterarStatus).
import { STATUS_ORDEM } from '@/lib/constants';
import type { Ocorrencia } from '@/lib/db/types';
import { pedidoPendente } from '@/features/ocorrencias/proxima-acao';

export type ResultadoValidacao = { ok: true } | { ok: false; campo: 'obs' | 'evidencia'; erro: string };

export const ERRO_REGRESSAO = 'Para retroceder o status é preciso informar uma justificativa.';
export const ERRO_EVIDENCIA = 'Para resolver a ocorrência, informe a evidência da resolução.';
export const ERRO_PEDIDO = 'Há um pedido de reabertura pendente — informe uma justificativa ao resolver novamente.';

export function ehRegressao(statusAtual: string, statusNovo: string): boolean {
  const ordem = STATUS_ORDEM as readonly string[];
  const a = ordem.indexOf(statusAtual);
  const n = ordem.indexOf(statusNovo);
  return a !== -1 && n !== -1 && n < a;
}

interface Entrada {
  atual: Pick<Ocorrencia, 'status' | 'pedidosReabertura' | 'evidenciaResolucao'>;
  novo: string;
  obs?: string | null;
  evidencia?: string | null;
}

/**
 * - Retroceder exige justificativa.
 * - Resolver exige evidência. Exceção: a ocorrência já está resolvida com evidência (só reafirmar, ex.:
 *   "manter resolvida" diante de um pedido de reabertura, que exige justificativa).
 * - Resolver com pedido de reabertura pendente exige justificativa.
 */
export function validarMudancaStatus({ atual, novo, obs, evidencia }: Entrada): ResultadoValidacao {
  const obsLimpa = (obs ?? '').trim();
  if (ehRegressao(atual.status, novo) && !obsLimpa) return { ok: false, campo: 'obs', erro: ERRO_REGRESSAO };
  if (novo === 'Resolvida') {
    const jaTem = atual.status === 'Resolvida' && !!(atual.evidenciaResolucao || '').trim();
    if (!(evidencia ?? '').trim() && !jaTem) return { ok: false, campo: 'evidencia', erro: ERRO_EVIDENCIA };
    if (pedidoPendente(atual) && !obsLimpa) return { ok: false, campo: 'obs', erro: ERRO_PEDIDO };
  }
  return { ok: true };
}
