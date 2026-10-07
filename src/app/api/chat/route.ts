import { enviarChat, listarChat } from '@/features/chat/service';
import { getAuth } from '@/features/auth/session';
import { parseBody, respond, route, UNAUTHENTICATED } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const auth = await getAuth(req);
  if (!auth) return respond(req, UNAUTHENTICATED);
  return respond(req, await listarChat());
});

export const POST = route(async (req) => {
  const auth = await getAuth(req);
  if (!auth) return respond(req, UNAUTHENTICATED);
  return respond(req, await enviarChat(auth.user, () => parseBody(req)));
});
