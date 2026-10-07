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

/** Próxima ação do ponto de vista da prefeitura (painel admin). */
export function proximaAcaoAdminTexto(o: Pick<Ocorrencia, 'status' | 'avaliacao' | 'prazo' | 'responsavel' | 'setor' | 'pedidosReabertura'> & { atrasada?: boolean }): string {
  if (pedidoPendente(o)) return 'O cidadão pediu a reabertura: reabra ou mantenha como resolvida, com justificativa.';
  if (o.status === 'Resolvida') return o.avaliacao ? `Nada a fazer: o cidadão avaliou com ${o.avaliacao.nota} de 5.` : 'Resolvida. Aguardando a avaliação do cidadão.';
  if (o.prazo && o.atrasada) return `Prazo vencido em ${fmtDate(o.prazo)}: atualize o status ou renegocie o prazo.`;
  if (o.status === 'Recebida') return 'Faça a triagem: analise e encaminhe ao setor responsável.';
  if (!o.responsavel && !o.setor) return 'Defina o setor ou o responsável pelo atendimento.';
  if (!o.prazo) return 'Defina um prazo de retorno para o cidadão.';
  return `Acompanhar até o prazo de ${fmtDate(o.prazo)}.`;
}
