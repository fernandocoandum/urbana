import { enviarImagem } from '@/features/upload/service';
import { getAuth } from '@/features/auth/session';
import { UNAUTHENTICATED, parseBody, respond, route } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  const auth = await getAuth(req);
  if (!auth) return respond(req, UNAUTHENTICATED);
  return respond(req, await enviarImagem(auth.user, await parseBody(req)));
});
