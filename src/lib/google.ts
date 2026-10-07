// Valida o ID token do Google Identity Services com o próprio Google (tokeninfo).
// Devolve null em qualquer falha (rede, timeout, status != 200, corpo inválido).
export async function verificarTokenGoogle(idToken: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), {
      signal: AbortSignal.timeout(8000),
    });
    if (r.status !== 200) return null;
    const d = await r.text();
    if (d.length > 20000) return null;
    return JSON.parse(d);
  } catch {
    return null;
  }
}
