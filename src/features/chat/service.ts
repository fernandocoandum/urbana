import { getDb } from '@/lib/db';
import type { User } from '@/lib/db/types';
import type { Body, ServiceResult } from '@/lib/http';
import { rateLimit } from '@/lib/rate-limit';
import { cap } from '@/lib/validation';

const j = (status: number, body: unknown): ServiceResult => ({ status, body });

export async function listarChat(): Promise<ServiceResult> {
  const db = await getDb();
  const msgs = await db.listChatMensagens();
  const usuariosPorId: Record<string, User | null> = {};
  for (const uid of [...new Set(msgs.map(m => m.userId))]) {
    usuariosPorId[uid] = await db.findUserById(uid);
  }
  // Nome e foto sempre refletem o perfil atual do autor, não um retrato da mensagem antiga.
  return j(200, msgs.map(m => {
    const u = usuariosPorId[m.userId];
    return { ...m, nome: u ? u.nome : m.nome, foto: u ? (u.foto || null) : null };
  }));
}

export async function enviarChat(user: User, body: Body): Promise<ServiceResult> {
  const db = await getDb();
  const rl = rateLimit('chat:' + user.id, 30, 60 * 1000);
  if (rl.limited) return j(429, { erro: 'Você está enviando mensagens rápido demais. Espere um pouco.' });
  const { texto } = body;
  if (typeof texto !== 'string' || !texto.trim()) return j(400, { erro:'Mensagem vazia.' });
  const msg = { id:'msg'+Date.now()+Math.random().toString(36).slice(2,7), userId:user.id, nome:user.nome, texto:cap(texto,500) as string, criadoEm:new Date().toISOString() };
  await db.addChatMensagem(msg);
  return j(201, { ok:true, id: msg.id });
}
