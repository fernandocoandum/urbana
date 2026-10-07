import { alterarStatus } from '@/features/ocorrencias/service';
import { getAuth } from '@/features/auth/session';
import { parseBody, respond, route } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const auth = await getAuth(req);
  const user = auth?.user ?? null;
  // Sem sessão válida ou sem papel de admin: 403 antes de ler o corpo (igual ao servidor legado).
  if (!user || user.role !== 'admin') return respond(req, await alterarStatus(null, id, {}));
  return respond(req, await alterarStatus(user, id, await parseBody(req)));
});
