import { expect, test } from '@playwright/test';

// Headers de segurança nas páginas HTML (next.config.ts) e nas respostas de API (src/lib/http.ts).
for (const caminho of ['/entrar', '/api/me']) {
  test(`${caminho} carrega os headers de segurança`, async ({ request }) => {
    const res = await request.get(caminho);
    const h = res.headers();
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['content-security-policy']).toContain("default-src 'self'");
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(h['strict-transport-security']).toBeTruthy();
    expect(h['x-powered-by']).toBeUndefined();
  });
}

// A vitrine de componentes não aparece em produção: com `next start` sem URBANA_DEV_UI, é 404.
test('/dev/ui responde 404 em build de produção', async ({ request }) => {
  const res = await request.get('/dev/ui');
  expect(res.status()).toBe(404);
});
