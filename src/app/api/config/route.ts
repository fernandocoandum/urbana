import { config } from '@/features/auth/service';
import { respond, route } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => respond(req, config()));
