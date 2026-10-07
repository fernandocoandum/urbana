import { avaliar } from '@/features/ocorrencias/service';
import { getAuth } from '@/features/auth/session';
import { UNAUTHENTICATED, parseBody, respond, route } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await getAuth(req);
  if (!auth) return respond(req, UNAUTHENTICATED);
  return respond(req, await avaliar(auth.user, id, await parseBody(req)));
});
