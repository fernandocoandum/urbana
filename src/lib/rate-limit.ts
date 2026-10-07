// Rate limiting simples em memória (por chave), protege contra força bruta e abuso.
// O store fica em globalThis para sobreviver ao HMR do `next dev`.
type Entry = { count: number; resetAt: number };
const g = globalThis as unknown as { __urbanaRateLimit?: Map<string, Entry> };

function store(): Map<string, Entry> {
  return (g.__urbanaRateLimit ??= new Map());
}

export function rateLimit(key: string, limit: number, windowMs: number): { limited: boolean; retryAfter?: number } {
  const rateLimitStore = store();
  const now = Date.now();
  if (rateLimitStore.size > 10000) {
    for (const [k, v] of rateLimitStore) if (now > v.resetAt) rateLimitStore.delete(k);
  }
  let entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitStore.set(key, entry);
  }
  entry.count++;
  if (entry.count > limit) return { limited: true, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  return { limited: false };
}
