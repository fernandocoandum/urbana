import { stats } from '@/features/ocorrencias/service';
import { getAuth } from '@/features/auth/session';
import { respond, route } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const auth = await getAuth(req);
  return respond(req, await stats(auth?.user ?? null));
});
