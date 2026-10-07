import type { Ocorrencia } from '@/lib/db/types';
import { fmtDate } from '@/lib/format';

/** Texto da "próxima ação" no resumo da ocorrência (port literal de `proximaAcaoTexto` do legado). */
export function proximaAcaoTexto(o: Pick<Ocorrencia, 'status' | 'avaliacao' | 'prazo'> & { atrasada?: boolean }): string {
  if (o.status === 'Resolvida') return o.avaliacao ? 'Nenhuma — obrigado por avaliar!' : 'Avalie como foi a resolução, logo abaixo.';
  if (o.prazo) return `Previsão de retorno até ${fmtDate(o.prazo)}${o.atrasada ? ' (em atraso)' : ''}.`;
  return 'Aguardando análise da equipe responsável.';
}

/** Último pedido de reabertura ainda sem retorno da equipe, se houver. */
export function pedidoPendente(o: Pick<Ocorrencia, 'pedidosReabertura'>) {
  const lista = o.pedidosReabertura || [];
  const ultimo = lista[lista.length - 1];
  return ultimo && !ultimo.atendido ? ultimo : null;
}
