import { logout } from '@/features/auth/service';
import { assertSameOrigin, readCredential } from '@/features/auth/session';
import { respond, route } from '@/lib/http';
import { SESSION_COOKIE } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  const cred = readCredential(req);
  if (cred?.via === 'cookie') assertSameOrigin(req);
  const tokens = [cred?.token ?? '', req.cookies.get(SESSION_COOKIE)?.value ?? ''];
  return respond(req, await logout(tokens));
});
