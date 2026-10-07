import { recuperarSenha } from '@/features/auth/service';
import { assertSameOrigin } from '@/features/auth/session';
import { baseUrlFromReq, clientIp, parseBody, respond, route } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  // Login/cadastro CSRF: bloqueia Origin de outro host mesmo sem cookie de sessão.
  assertSameOrigin(req);
  return respond(req, await recuperarSenha(clientIp(req), baseUrlFromReq(req), () => parseBody(req)));
});
