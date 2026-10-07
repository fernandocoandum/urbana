import { BAIRROS_VALIDOS } from '@/lib/constants';
import { getDb } from '@/lib/db';
import type { User } from '@/lib/db/types';
import type { Body, ServiceResult } from '@/lib/http';
import { cap, isOwnUploadUrl } from '@/lib/validation';

const j = (status: number, body: unknown): ServiceResult => ({ status, body });

export async function getPerfil(user: User): Promise<ServiceResult> {
  const db = await getDb();
  const minhas = await db.listOcorrencias({ userId: user.id });
  const resolvidas = minhas.filter(o => o.status === 'Resolvida').length;
  const apoiosDados = await db.contarApoiosDados(user.id);
  return j(200, {
    nome:user.nome, email:user.email, foto:user.foto||null,
    bairro:user.bairro||'', criadoEm:user.criadoEm||null,
    stats: { ocorrencias: minhas.length, resolvidas, apoiosDados },
    recentes: minhas.slice().sort((a,b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()).slice(0,4)
      .map(o => ({ id:o.id, protocolo:o.protocolo, titulo:o.titulo, status:o.status, categoria:o.categoria, criadoEm:o.criadoEm }))
  });
}

export async function atualizarPerfil(user: User, body: Body): Promise<ServiceResult> {
  const db = await getDb();
  const { nome, foto, bairro } = body;
  const upd: { nome?: string; foto?: string | null; bairro?: string } = {};
  if (nome !== undefined) {
    if (typeof nome !== 'string' || !nome.trim()) return j(400, { erro:'Nome não pode ficar em branco.' });
    upd.nome = cap(nome, 100);
  }
  if (foto !== undefined) {
    if (!isOwnUploadUrl(foto)) return j(400, { erro:'Foto inválida.' });
    upd.foto = foto;
  }
  // Aditivo (Etapa B): bairro opcional, vazio ou da lista fechada.
  if (bairro !== undefined) {
    if (typeof bairro !== 'string' || (bairro !== '' && !BAIRROS_VALIDOS.has(bairro))) return j(400, { erro:'Bairro inválido.' });
    upd.bairro = bairro;
  }
  await db.updatePerfil(user.id, upd);
  return j(200, { ok:true });
}

export async function perfilPublico(id: string): Promise<ServiceResult> {
  const db = await getDb();
  const alvo = await db.findUserById(id);
  if (!alvo) return j(404, { erro:'Usuário não encontrado.' });
  const dele = await db.listOcorrencias({ userId: alvo.id });
  const resolvidas = dele.filter(o => o.status === 'Resolvida').length;
  const apoiosDados = await db.contarApoiosDados(alvo.id);
  return j(200, {
    nome:alvo.nome, foto:alvo.foto||null,
    stats: { ocorrencias: dele.length, resolvidas, apoiosDados }
  });
}
