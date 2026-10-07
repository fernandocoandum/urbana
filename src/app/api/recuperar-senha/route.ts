import { recuperarSenha } from '@/features/auth/service';
import { baseUrlFromReq, clientIp, parseBody, respond, route } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async (req) =>
  respond(req, await recuperarSenha(clientIp(req), baseUrlFromReq(req), await parseBody(req))));
