import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { SESSION_COOKIE, SESSION_TTL_MS } from '@/lib/constants';
import { DbUnavailable, getDb } from '@/lib/db';

// Headers de segurança aplicados em toda resposta de API (as páginas recebem os mesmos via
// next.config.ts). 'unsafe-inline' em script-src: hidratação do Next e next-themes (ver PLANO).
export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(self), camera=(), microphone=(), payment=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': [
    "default-src 'self'",
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
    "media-src 'self'",
    "script-src 'self' 'unsafe-inline' https://accounts.google.com",
    'frame-src https://accounts.google.com',
    "style-src 'self' 'unsafe-inline' https://accounts.google.com",
    "font-src 'self'",
    "connect-src 'self' https://accounts.google.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
};

// Restrito à própria origem do app em produção (VERCEL_URL/PUBLIC_ORIGIN); '*' só permanece
// como fallback de desenvolvimento local. Calculado a cada resposta (env lido de forma preguiçosa).
export function corsHeaders(): Record<string, string> {
  const allowed = env.PUBLIC_ORIGIN || (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : null);
  return {
    'Access-Control-Allow-Origin': allowed || '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Vary': 'Origin',
  };
}

export function json(status: number, data: unknown, extraHeaders: Record<string, string> = {}): NextResponse {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(), ...SECURITY_HEADERS, ...extraHeaders },
  });
}

/** Resultado devolvido pelos services; o handler converte em Response. */
export interface ServiceResult {
  status: number;
  body: unknown;
  /** Se presente, grava o cookie de sessão com este token. */
  setSession?: string;
  /** Se true, apaga o cookie de sessão. */
  clearSession?: boolean;
}
export const UNAUTHENTICATED: ServiceResult = { status: 401, body: { erro: 'Não autenticado.' } };

export function protoIsHttps(req: NextRequest): boolean {
  const fwd = req.headers.get('x-forwarded-proto');
  if (fwd) return fwd.split(',')[0]!.trim() === 'https';
  return req.nextUrl.protocol === 'https:';
}

export function setSessionCookie(res: NextResponse, token: string, req: NextRequest): void {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    secure: protoIsHttps(req),
  });
}
export function clearSessionCookie(res: NextResponse, req: NextRequest): void {
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    secure: protoIsHttps(req),
  });
}

export function respond(req: NextRequest, r: ServiceResult): NextResponse {
  const res = json(r.status, r.body);
  if (r.setSession) setSessionCookie(res, r.setSession, req);
  if (r.clearSession) clearSessionCookie(res, req);
  return res;
}

/** Erro com status HTTP próprio (ex.: CSRF), tratado por route(). */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
class PayloadTooLarge extends Error {
  tooLarge = true;
  constructor() { super('PAYLOAD_TOO_LARGE'); }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Body = Record<string, any>;

const MAX_BODY = 20e6;
/** Lê o corpo JSON (limite de 20MB → 413). JSON inválido ou vazio vira {}. */
export async function parseBody(req: NextRequest): Promise<Body> {
  const len = Number(req.headers.get('content-length'));
  if (Number.isFinite(len) && len > MAX_BODY) throw new PayloadTooLarge();
  const text = await req.text();
  if (text.length > MAX_BODY) throw new PayloadTooLarge();
  try { return JSON.parse(text || '{}'); } catch { return {}; }
}

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return 'desconhecido';
}

export function baseUrlFromReq(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') || (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
  return `${proto}://${host}`;
}

type HandlerFn<C> = (req: NextRequest, ctx: C) => Promise<Response>;

/**
 * HOF dos Route Handlers: garante o banco (503 se indisponível, antes de qualquer outra checagem,
 * como no servidor legado) e converte exceções em 413/500 com as mesmas mensagens.
 */
export function route<C = unknown>(fn: HandlerFn<C>) {
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    try {
      await getDb();
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof DbUnavailable) {
        return json(503, { erro: 'Serviço temporariamente indisponível (banco de dados fora do ar). Tente novamente em instantes.' });
      }
      if (e instanceof HttpError) return json(e.status, { erro: e.message });
      if (e && (e as { tooLarge?: boolean }).tooLarge) {
        console.error('Erro: payload muito grande');
        return json(413, { erro: 'Arquivo muito grande. Tente uma imagem menor.' });
      }
      console.error('Erro:', e instanceof Error ? e.message : e);
      return json(500, { erro: 'Erro interno do servidor.' });
    }
  };
}
