import { json } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const naoEncontrada = () => json(404, { erro: 'Rota não encontrada.' });

export const GET = naoEncontrada;
export const POST = naoEncontrada;
export const PUT = naoEncontrada;
export const PATCH = naoEncontrada;
export const DELETE = naoEncontrada;
