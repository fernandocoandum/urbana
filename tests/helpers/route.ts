import { NextRequest } from 'next/server';

// Chama os Route Handlers in-process (sem subir servidor): resolve o caminho para o módulo
// `route.ts` correspondente, extrai os params dinâmicos e devolve a Response.
type RouteModule = Record<string, unknown>;
const ROUTES: [RegExp, string[], () => Promise<RouteModule>][] = [
  [/^\/api\/cadastro$/, [], () => import('@/app/api/cadastro/route')],
  [/^\/api\/login$/, [], () => import('@/app/api/login/route')],
  [/^\/api\/login\/google$/, [], () => import('@/app/api/login/google/route')],
  [/^\/api\/logout$/, [], () => import('@/app/api/logout/route')],
  [/^\/api\/me$/, [], () => import('@/app/api/me/route')],
  [/^\/api\/config$/, [], () => import('@/app/api/config/route')],
  [/^\/api\/aceitar-termos$/, [], () => import('@/app/api/aceitar-termos/route')],
  [/^\/api\/perfil$/, [], () => import('@/app/api/perfil/route')],
  [/^\/api\/usuarios\/([^/]+)\/perfil$/, ['id'], () => import('@/app/api/usuarios/[id]/perfil/route')],
  [/^\/api\/chat$/, [], () => import('@/app/api/chat/route')],
  [/^\/api\/stats$/, [], () => import('@/app/api/stats/route')],
  [/^\/api\/ocorrencias$/, [], () => import('@/app/api/ocorrencias/route')],
  [/^\/api\/ocorrencias\/([^/]+)$/, ['id'], () => import('@/app/api/ocorrencias/[id]/route')],
  [/^\/api\/ocorrencias\/([^/]+)\/status$/, ['id'], () => import('@/app/api/ocorrencias/[id]/status/route')],
  [/^\/api\/ocorrencias\/([^/]+)\/mensagens$/, ['id'], () => import('@/app/api/ocorrencias/[id]/mensagens/route')],
  [/^\/api\/ocorrencias\/([^/]+)\/marcar-lida$/, ['id'], () => import('@/app/api/ocorrencias/[id]/marcar-lida/route')],
  [/^\/api\/ocorrencias\/([^/]+)\/reabrir$/, ['id'], () => import('@/app/api/ocorrencias/[id]/reabrir/route')],
  [/^\/api\/ocorrencias\/([^/]+)\/apoiar$/, ['id'], () => import('@/app/api/ocorrencias/[id]/apoiar/route')],
  [/^\/api\/ocorrencias\/([^/]+)\/avaliar$/, ['id'], () => import('@/app/api/ocorrencias/[id]/avaliar/route')],
  [/^\/api\/mapa$/, [], () => import('@/app/api/mapa/route')],
  [/^\/api\/geocode$/, [], () => import('@/app/api/geocode/route')],
  [/^\/api\/recuperar-senha$/, [], () => import('@/app/api/recuperar-senha/route')],
  [/^\/api\/redefinir-senha$/, [], () => import('@/app/api/redefinir-senha/route')],
  [/^\/api\/upload$/, [], () => import('@/app/api/upload/route')],
  [/^\/api\/arquivos\/([^/]+)$/, ['id'], () => import('@/app/api/arquivos/[id]/route')],
];
const CATCH_ALL = () => import('@/app/api/[...rota]/route');

export interface CallOptions { body?: unknown; headers?: Record<string, string> }

export async function call(method: string, path: string, { body, headers = {} }: CallOptions = {}): Promise<Response> {
  const pathname = path.split('?')[0]!;
  const init: { method: string; headers: Record<string, string>; body?: string } = { method, headers: { ...headers } };
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
    if (!Object.keys(init.headers).some((h) => h.toLowerCase() === 'content-type')) init.headers['Content-Type'] = 'application/json';
  }
  const req = new NextRequest('http://localhost' + path, init);

  let mod: RouteModule | undefined;
  const params: Record<string, string> = {};
  for (const [re, names, load] of ROUTES) {
    const m = re.exec(pathname);
    if (m) {
      names.forEach((n, i) => { params[n] = m[i + 1]!; });
      mod = await load();
      break;
    }
  }
  let ctx: { params: Promise<Record<string, unknown>> } = { params: Promise.resolve(params) };
  if (!mod) {
    mod = await CATCH_ALL();
    ctx = { params: Promise.resolve({ rota: pathname.replace(/^\/api\//, '').split('/') }) };
  }
  const handler = mod[method.toUpperCase()] as ((r: NextRequest, c: typeof ctx) => Promise<Response>) | undefined;
  // Como o Next: método não exportado pela rota responde 405.
  if (!handler) return new Response(null, { status: 405 });
  return handler(req, ctx);
}
