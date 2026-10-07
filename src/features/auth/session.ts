import type { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import type { User } from '@/lib/db/types';
import { SESSION_COOKIE } from '@/lib/constants';
import { HttpError } from '@/lib/http';

// IMPORTANTE: Route Handlers leem cookies de req.cookies (nunca de next/headers), senão os
// testes in-process (sem contexto de request do Next) quebram.

export type AuthVia = 'bearer' | 'cookie';
export interface Credential { token: string; via: AuthVia; hasCookie: boolean; cookieToken: string }
export interface Auth extends Credential { user: User }

// Mesma extração do servidor legado: remove o prefixo "Bearer " e aparas.
function bearerToken(req: NextRequest): string {
  return (req.headers.get('authorization') || '').replace('Bearer ', '').trim();
}

/** Credencial da requisição: Bearer primeiro, depois cookie `urbana_token`. */
export function readCredential(req: NextRequest): Credential | null {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value || '';
  const bearer = bearerToken(req);
  if (bearer) return { token: bearer, via: 'bearer', hasCookie: !!cookie, cookieToken: cookie };
  if (cookie) return { token: cookie, via: 'cookie', hasCookie: true, cookieToken: cookie };
  return null;
}

/**
 * Proteção CSRF: em métodos que não sejam GET autenticados por cookie, se existir `Origin` e o
 * host dele for diferente de x-forwarded-host/host, responde 403.
 */
export function assertSameOrigin(req: NextRequest): void {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
  const origin = req.headers.get('origin');
  if (!origin) return;
  const esperado = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host;
  let host: string | null = null;
  try { host = new URL(origin).host; } catch { host = null; }
  if (host !== esperado) throw new HttpError(403, 'Origem não permitida.');
}

export async function getAuth(req: NextRequest): Promise<Auth | null> {
  const cred = readCredential(req);
  if (!cred) return null;
  if (cred.via === 'cookie') assertSameOrigin(req);
  const db = await getDb();
  const session = await db.getSession(cred.token);
  if (!session) return null;
  const user = await db.findUserById(session.userId);
  if (!user) return null;
  return { ...cred, user };
}

export async function getAuthUser(req: NextRequest): Promise<User | null> {
  return (await getAuth(req))?.user ?? null;
}
