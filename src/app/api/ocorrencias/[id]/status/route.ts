import { alterarStatus } from '@/features/ocorrencias/service';
import { getAuth } from '@/features/auth/session';
import { parseBody, respond, route } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await getAuth(req);
  // O service responde 403 antes de ler o corpo se não for admin (igual ao servidor legado).
  return respond(req, await alterarStatus(auth?.user ?? null, id, () => parseBody(req)));
});
