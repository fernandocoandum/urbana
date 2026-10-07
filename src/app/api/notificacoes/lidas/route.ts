import { marcarLidas } from '@/features/notificacoes/service';
import { getAuth } from '@/features/auth/session';
import { UNAUTHENTICATED, parseBody, respond, route } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  const auth = await getAuth(req); // getAuth aplica a checagem de origem (CSRF) quando a credencial é cookie
  if (!auth) return respond(req, UNAUTHENTICATED);
  return respond(req, await marcarLidas(auth.user, () => parseBody(req)));
});
