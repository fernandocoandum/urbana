// Proxy simples para o Nominatim (geocodificação, direta e reversa): evita que o cliente
// chame o serviço diretamente, o que violaria a CSP (connect-src 'self').
async function nominatimRequest(pathAndQuery: string): Promise<unknown> {
  let text: string;
  try {
    const r = await fetch('https://nominatim.openstreetmap.org' + pathAndQuery, {
      headers: { 'User-Agent': 'UrbanaBracoDoNorte/1.0 (contato: prefeitura)', 'Accept-Language': 'pt-BR' },
      signal: AbortSignal.timeout(8000),
    });
    text = await r.text();
  } catch (e) {
    if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
      throw new Error('Tempo esgotado ao consultar geocodificação.');
    }
    throw e;
  }
  if (text.length > 1_000_000) throw new Error('Resposta inválida do serviço de geocodificação.');
  try { return JSON.parse(text); } catch { throw new Error('Resposta inválida do serviço de geocodificação.'); }
}

export function geocodeNominatim(query: string) {
  const qs = new URLSearchParams({ q: query, format: 'json', limit: '5', countrycodes: 'br' });
  return nominatimRequest('/search?' + qs.toString());
}
export function reverseGeocodeNominatim(lat: number, lng: number) {
  const qs = new URLSearchParams({ format: 'json', lat: String(lat), lon: String(lng), zoom: '18', addressdetails: '1' });
  return nominatimRequest('/reverse?' + qs.toString());
}
