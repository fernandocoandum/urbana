'use client';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type Redirector = (path: string) => void;
let onUnauthorized: Redirector | null = null;

/** O SessionProvider registra aqui o `router.replace`, para o 401 mandar o usuário a /entrar. */
export function setUnauthorizedHandler(fn: Redirector | null) {
  onUnauthorized = fn;
}

/** Cliente do contrato /api/*: cookie de sessão same-origin; lança ApiError com a mensagem do servidor. */
export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data: unknown = null;
  try { data = await res.json(); } catch { /* corpo vazio ou não-JSON */ }
  if (!res.ok) {
    const msg = (data as { erro?: string } | null)?.erro || 'Erro desconhecido';
    // 401 fora das telas de login (que mostram o erro no próprio formulário) volta ao /entrar.
    if (res.status === 401 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/entrar')) {
      onUnauthorized?.('/entrar');
    }
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

/** Fetcher do SWR sobre o mesmo contrato. */
export const fetcher = <T = unknown>(path: string) => api<T>('GET', path);
