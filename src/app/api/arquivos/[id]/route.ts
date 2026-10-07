import { NextResponse } from 'next/server';
import { buscarImagem } from '@/features/upload/service';
import { corsHeaders, json, route, SECURITY_HEADERS } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const img = await buscarImagem(id);
  if (!img) {
    // Id fora do formato [A-Za-z0-9]+ caía na rota genérica do servidor legado.
    return json(404, { erro: /^[A-Za-z0-9]+$/.test(id) ? 'Arquivo não encontrado.' : 'Rota não encontrada.' });
  }
  return new NextResponse(new Uint8Array(img.buffer), {
    status: 200,
    headers: { 'Content-Type': img.mime, 'Cache-Control': 'public, max-age=31536000, immutable', ...corsHeaders(), ...SECURITY_HEADERS },
  });
});
