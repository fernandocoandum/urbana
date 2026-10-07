import { listar } from '@/features/notificacoes/service';
import { getAuth } from '@/features/auth/session';
import { UNAUTHENTICATED, respond, route } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const auth = await getAuth(req);
  if (!auth) return respond(req, UNAUTHENTICATED);
  return respond(req, await listar(auth.user));
});
