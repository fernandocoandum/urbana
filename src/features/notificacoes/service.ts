import { after } from 'next/server';
import { getDb } from '@/lib/db';
import type { Notificacao, Ocorrencia, User } from '@/lib/db/types';
import { env } from '@/lib/env';
import type { ReadBody, ServiceResult } from '@/lib/http';
import { enviarEmail, htmlEmailNotificacao } from '@/lib/mail';
import { devePularEmail, linkDaOcorrencia, type NotificacaoNova } from './regras';

const j = (status: number, body: unknown): ServiceResult => ({ status, body });

const MAX_IDS = 100;
const LIMITE_LISTA = 30;
// Teto para resolver `ocorrenciaId` em ids: bem acima do que a lista mostra.
const LIMITE_POR_OCORRENCIA = 200;

/**
 * Roda `fn` fora do caminho crítico da resposta (`after` do Next). Fora de um request do Next
 * (testes in-process do Vitest, scripts) o `after` lança; aí cai em disparo simples. Nunca propaga erro.
 */
export function agendar(fn: () => Promise<void>): void {
  const seguro = () => fn().catch((e) => console.error('[notificacoes] falha em tarefa agendada:', e instanceof Error ? e.message : e));
  try {
    after(seguro);
  } catch {
    void seguro();
  }
}

async function enviarEmailDaNotificacao(userId: string, ocorrenciaId: string, n: NotificacaoNova): Promise<void> {
  if (devePularEmail(env)) return;
  const db = await getDb();
  const user = await db.findUserById(userId);
  if (!user?.email) return;
  const link = linkDaOcorrencia(env, ocorrenciaId);
  await enviarEmail(user.email, n.titulo, htmlEmailNotificacao(n.titulo, n.texto, link));
}

/**
 * Grava a notificação do dono da ocorrência e, quando há Gmail/Resend, dispara o e-mail depois da
 * resposta. Falha de notificação NUNCA derruba a operação que a originou: tudo em try/catch.
 * A gravação no banco é sempre aguardada; só o e-mail vai para `agendar`.
 */
export async function notificarCidadao(oc: Pick<Ocorrencia, 'id' | 'userId'>, n: NotificacaoNova | null): Promise<void> {
  if (!n) return;
  try {
    const db = await getDb();
    const registro: Notificacao = {
      id: 'nt' + Date.now() + Math.random().toString(36).slice(2, 8),
      userId: oc.userId,
      ocorrenciaId: oc.id,
      tipo: n.tipo,
      titulo: n.titulo,
      texto: n.texto,
      lida: false,
      criadoEm: new Date().toISOString(),
    };
    await db.criarNotificacao(registro);
    agendar(() => enviarEmailDaNotificacao(oc.userId, oc.id, n));
  } catch (e) {
    console.error('[notificacoes] falha ao notificar o cidadão:', e instanceof Error ? e.message : e);
  }
}

export async function listar(user: User): Promise<ServiceResult> {
  const db = await getDb();
  const [itens, naoLidas] = await Promise.all([
    db.listarNotificacoes(user.id, LIMITE_LISTA),
    db.contarNotificacoesNaoLidas(user.id),
  ]);
  return j(200, { itens, naoLidas });
}

/** Corpo: `{ ids?: string[], ocorrenciaId?: string }`. Sem nenhum dos dois, marca todas do usuário. */
export async function marcarLidas(user: User, readBody: ReadBody): Promise<ServiceResult> {
  const db = await getDb();
  const { ids, ocorrenciaId } = await readBody();
  if (ids !== undefined && (!Array.isArray(ids) || ids.some((x) => typeof x !== 'string'))) return j(400, { erro: 'ids inválidos.' });
  if (ocorrenciaId !== undefined && typeof ocorrenciaId !== 'string') return j(400, { erro: 'ocorrenciaId inválido.' });

  if (ids === undefined && ocorrenciaId === undefined) {
    await db.marcarNotificacoesLidas(user.id);
  } else {
    const alvo = new Set<string>((ids as string[] | undefined)?.slice(0, MAX_IDS) ?? []);
    if (ocorrenciaId) {
      // Só enxerga as do próprio usuário (a listagem já filtra por userId).
      const dele = await db.listarNotificacoes(user.id, LIMITE_POR_OCORRENCIA);
      for (const n of dele) if (n.ocorrenciaId === ocorrenciaId && !n.lida) alvo.add(n.id);
    }
    if (alvo.size > 0) await db.marcarNotificacoesLidas(user.id, [...alvo].slice(0, MAX_IDS));
  }
  return j(200, { ok: true, naoLidas: await db.contarNotificacoesNaoLidas(user.id) });
}
