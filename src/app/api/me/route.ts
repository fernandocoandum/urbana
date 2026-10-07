import { me } from '@/features/auth/service';
import { getAuth } from '@/features/auth/session';
import { respond, route, UNAUTHENTICATED } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const auth = await getAuth(req);
  if (!auth) return respond(req, UNAUTHENTICATED);
  return respond(req, me(auth));
});
