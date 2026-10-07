import { BAIRROS } from '../categorias';

export interface GeocodeReverso {
  enderecoSugerido?: string | null;
  rua?: string | null;
  numero?: string | null;
  bairroDetectado?: string | null;
}

/** Bairro da lista que combina com o detectado pelo geocodificador (mesma regra do legado). */
export function escolherBairro(detectado: string | null | undefined, opcoes: readonly string[] = BAIRROS): string | undefined {
  const d = (detectado || '').toLowerCase();
  if (!d) return undefined;
  return opcoes.find((o) => o.toLowerCase().includes(d) || d.includes(o.toLowerCase()));
}

export const coordenadasComoTexto = (lat: number, lng: number) => `Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`;

/** Endereço a preencher depois do GPS (port de `usarLocalizacao`). */
export function enderecoDoGps(data: GeocodeReverso, lat: number, lng: number): string {
  const rua = data.rua || '';
  const numero = data.numero ? `, ${data.numero}` : '';
  if (rua) return rua + numero;
  if (data.enderecoSugerido) return data.enderecoSugerido.split(',').slice(0, 2).join(',').trim();
  return coordenadasComoTexto(lat, lng);
}

/** Sugestão do /api/geocode?q=: endereço curto (2 primeiros trechos) e bairro, se algum trecho for um bairro conhecido. */
export function interpretarSugestao(nome: string): { endereco: string; bairro?: string } {
  const partes = nome.split(',').map((p) => p.trim()).filter(Boolean);
  const bairro = partes.map((p) => BAIRROS.find((b) => b.toLowerCase() === p.toLowerCase())).find(Boolean);
  return { endereco: partes.slice(0, 2).join(', '), bairro };
}
