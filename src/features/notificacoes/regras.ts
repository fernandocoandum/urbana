// Regras puras das notificações ao cidadão (sem banco, sem rede): o que dizer e quando calar.
import type { Ocorrencia, TipoNotificacao } from '@/lib/db/types';

/** O que o service completa com id, userId, lida e criadoEm. */
export interface NotificacaoNova {
  tipo: TipoNotificacao;
  titulo: string;
  texto: string;
}

type OcRef = Pick<Ocorrencia, 'protocolo' | 'status' | 'setor'>;

const MAX_TEXTO_STATUS = 280;
export const MAX_TRECHO_MENSAGEM = 140;

function aparar(texto: string | null | undefined, max: number): string {
  const t = (texto ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

const TEXTO_PADRAO: Record<string, string> = {
  'Recebida': 'Recebemos a sua ocorrência.',
  'Em análise': 'A equipe da prefeitura começou a analisar a sua ocorrência.',
  'Encaminhada': 'A sua ocorrência foi encaminhada para a equipe responsável.',
  'Em atendimento': 'Uma equipe já está cuidando da sua ocorrência.',
  'Resolvida': 'A sua ocorrência foi marcada como resolvida. Conta pra gente se deu certo!',
};

/**
 * Notificação de mudança de status. `oc` é a ocorrência ANTES da alteração. Devolve `null` quando
 * nada mudou para o cidadão: mesmo status e nenhum setor novo.
 */
export function notificacaoDeStatus(
  oc: OcRef,
  statusNovo: string,
  obs: string | null | undefined,
  setor?: string | null,
): NotificacaoNova | null {
  const setorNovo = (setor ?? '').trim();
  const mudouStatus = oc.status !== statusNovo;
  const mudouSetor = !!setorNovo && setorNovo !== (oc.setor ?? '');
  if (!mudouStatus && !mudouSetor) return null;

  const observacao = aparar(obs, MAX_TEXTO_STATUS);
  const partes: string[] = [observacao || (mudouStatus ? TEXTO_PADRAO[statusNovo] ?? `O status agora é "${statusNovo}".` : `Encaminhada para ${setorNovo}.`)];
  if (mudouSetor && mudouStatus) partes.push(`Setor responsável: ${setorNovo}.`);

  const titulo = mudouStatus
    ? `Sua ocorrência ${oc.protocolo} está ${statusNovo}`
    : `Sua ocorrência ${oc.protocolo} foi encaminhada para ${setorNovo}`;
  return { tipo: 'status', titulo, texto: partes.join(' ') };
}

/** Resposta da prefeitura na conversa da ocorrência: só um trecho, o resto fica no detalhe. */
export function notificacaoDeMensagem(oc: Pick<Ocorrencia, 'protocolo'>, texto: string): NotificacaoNova {
  return {
    tipo: 'mensagem',
    titulo: `A prefeitura respondeu à sua ocorrência ${oc.protocolo}`,
    texto: aparar(texto, MAX_TRECHO_MENSAGEM),
  };
}

/**
 * O pedido de reabertura do cidadão foi respondido. `oc` é a ocorrência ANTES da alteração: se o
 * status mudou, a ocorrência voltou a andar ("atendido"); se continua resolvida, o pedido foi só analisado.
 */
export function notificacaoDeReaberturaAtendida(
  oc: Pick<Ocorrencia, 'protocolo' | 'status'>,
  statusNovo: string,
  obs?: string | null,
): NotificacaoNova {
  const voltou = oc.status !== statusNovo;
  return {
    tipo: 'reabertura',
    titulo: `Seu pedido de reabertura da ocorrência ${oc.protocolo} foi ${voltou ? 'atendido' : 'analisado'}`,
    texto:
      aparar(obs, MAX_TEXTO_STATUS) ||
      (voltou ? `A ocorrência voltou para "${statusNovo}".` : 'Revisamos a ocorrência e ela continua resolvida.'),
  };
}

/** `NOTIFICACOES_EMAIL=0` (ou false/off/nao) desliga o e-mail; as notificações no app continuam. */
export function devePularEmail(e: { NOTIFICACOES_EMAIL?: string | undefined }): boolean {
  const v = (e.NOTIFICACOES_EMAIL ?? '').trim().toLowerCase();
  return v === '0' || v === 'false' || v === 'off' || v === 'nao' || v === 'não';
}

/** Link para o detalhe no app; `null` quando não há origem pública conhecida (o e-mail omite o botão). */
export function linkDaOcorrencia(e: { PUBLIC_ORIGIN?: string | undefined; VERCEL_URL?: string | undefined }, id: string): string | null {
  const origem = (e.PUBLIC_ORIGIN || (e.VERCEL_URL ? 'https://' + e.VERCEL_URL : '')).trim().replace(/\/+$/, '');
  return origem ? `${origem}/ocorrencias/${encodeURIComponent(id)}` : null;
}
