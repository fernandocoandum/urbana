import crypto from 'node:crypto';
import { ALLOWED_IMAGE_MIME, MAX_IMAGE_BYTES } from '@/lib/constants';
import { getDb } from '@/lib/db';
import type { User } from '@/lib/db/types';
import type { ReadBody, ServiceResult } from '@/lib/http';
import { rateLimit } from '@/lib/rate-limit';
import { assinaturaImagemValida } from '@/lib/validation';

const j = (status: number, body: unknown): ServiceResult => ({ status, body });

export async function enviarImagem(user: User, readBody: ReadBody): Promise<ServiceResult> {
  const db = await getDb();
  const rl = rateLimit('upload:' + user.id, 40, 60 * 60 * 1000);
  if (rl.limited) return j(429, { erro: 'Muitos envios de imagem em pouco tempo. Tente novamente mais tarde.' });
  const { data } = await readBody();
  if (!data || typeof data !== 'string') return j(400, { erro:'Sem dados.' });
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(data);
  if (!match) return j(400, { erro:'Formato de imagem inválido.' });
  const mime = match[1]!.toLowerCase();
  if (!ALLOWED_IMAGE_MIME.has(mime)) return j(400, { erro:'Tipo de imagem não suportado. Envie JPEG, PNG, WEBP ou GIF.' });
  const base64 = match[2]!;
  let buffer: Buffer;
  try { buffer = Buffer.from(base64, 'base64'); } catch { return j(400, { erro:'Imagem corrompida.' }); }
  if (!buffer.length) return j(400, { erro:'Imagem vazia.' });
  if (buffer.length > MAX_IMAGE_BYTES) return j(400, { erro:'Imagem muito grande (máx. 8MB).' });
  if (!assinaturaImagemValida(mime, buffer)) return j(400, { erro:'O arquivo não é uma imagem válida do tipo declarado.' });
  // ID com 128 bits de entropia criptográfica — a única coisa que impede alguém de listar
  // fotos de outras pessoas é não conseguir adivinhar essa URL (a rota de leitura é pública,
  // sem checagem de dono, de propósito, pra funcionar em ocorrências/perfis públicos).
  const id = 'img' + crypto.randomBytes(16).toString('hex');
  await db.salvarArquivo(id, mime, base64);
  return j(200, { url:`/api/arquivos/${id}` });
}

/** Devolve a imagem (bytes + mime) ou null se não existir / id fora do formato aceito. */
export async function buscarImagem(id: string): Promise<{ mime: string; buffer: Buffer } | null> {
  if (!/^[A-Za-z0-9]+$/.test(id)) return null;
  const db = await getDb();
  const arq = await db.buscarArquivo(id);
  if (!arq) return null;
  return { mime: arq.mime, buffer: Buffer.from(arq.dados, 'base64') };
}
