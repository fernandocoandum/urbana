import type { User } from '@/lib/db/types';
import type { ServiceResult } from '@/lib/http';
import { geocodeNominatim, reverseGeocodeNominatim } from '@/lib/nominatim';
import { rateLimit } from '@/lib/rate-limit';
import { isCoordenadaValida } from '@/lib/validation';

const j = (status: number, body: unknown): ServiceResult => ({ status, body });

type Addr = Record<string, string | undefined>;

export async function geocode(user: User, sp: URLSearchParams): Promise<ServiceResult> {
  const rl = rateLimit('geocode:' + user.id, 30, 60 * 1000);
  if (rl.limited) return j(429, { erro:'Muitas buscas de endereço em pouco tempo. Aguarde um instante.' });
  const latParam = sp.get('lat');
  const lngParam = sp.get('lng');
  if (latParam !== null && lngParam !== null) {
    const lat = parseFloat(latParam), lng = parseFloat(lngParam);
    if (!isCoordenadaValida(lat, lng)) return j(400, { erro:'Coordenadas inválidas.' });
    try {
      const r = (await reverseGeocodeNominatim(lat, lng)) as { display_name?: string; address?: Addr } | null;
      const addr: Addr = (r && r.address) || {};
      return j(200, {
        enderecoSugerido: r?.display_name || null,
        rua: addr.road || addr.pedestrian || addr.residential || null,
        numero: addr.house_number || null,
        bairroDetectado: addr.suburb || addr.neighbourhood || addr.village || null
      });
    } catch (e) {
      console.error('Erro na geocodificação reversa:', e instanceof Error ? e.message : e);
      return j(502, { erro:'Não foi possível identificar o endereço agora. Tente novamente.' });
    }
  }
  const q = (sp.get('q') || '').trim();
  if (!q || q.length < 3) return j(400, { erro:'Digite ao menos 3 caracteres para buscar o endereço.' });
  try {
    const resultados = await geocodeNominatim(q + ', Braço do Norte, SC, Brasil');
    const pontos = (Array.isArray(resultados) ? resultados : []).slice(0,5).map((r: { lat: string; lon: string; display_name: string }) => ({
      lat: parseFloat(r.lat), lng: parseFloat(r.lon), nome: r.display_name
    })).filter(p => isCoordenadaValida(p.lat, p.lng));
    return j(200, pontos);
  } catch (e) {
    console.error('Erro na geocodificação:', e instanceof Error ? e.message : e);
    return j(502, { erro:'Não foi possível consultar o serviço de endereços agora. Tente novamente.' });
  }
}
