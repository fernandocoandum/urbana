import { cadastrar } from '@/features/auth/service';
import { clientIp, parseBody, respond, route } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async (req) => respond(req, await cadastrar(clientIp(req), await parseBody(req))));
