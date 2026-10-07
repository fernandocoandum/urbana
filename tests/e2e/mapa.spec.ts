// E2E — mapa da cidade: o cidadão abre /mapa, o Leaflet carrega e o modo "Calor" não gera erro no console.
import { expect, test, type Page } from '@playwright/test';

// 1x1 PNG neutro: os tiles do OSM não carregam no sandbox (e não devem depender de rede nos testes).
const TILE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function entrar(page: Page, request: import('@playwright/test').APIRequestContext) {
  const email = `e2e-mapa-${Date.now()}-${Math.floor(Math.random() * 1e4)}@teste.com`;
  const ip = () => '7.7.' + Math.floor(Math.random() * 200) + '.' + Math.floor(Math.random() * 200);
  await request.post('/api/cadastro', { data: { nome: 'Moradora do Mapa', email, senha: 'senha123', bairro: 'Centro' }, headers: { 'x-forwarded-for': ip() } });
  const login = await request.post('/api/login', { data: { email, senha: 'senha123' }, headers: { 'x-forwarded-for': ip() } });
  const { token } = await login.json();
  await request.post('/api/aceitar-termos', { headers: { Authorization: `Bearer ${token}` } });
  await request.post('/api/ocorrencias', {
    headers: { Authorization: `Bearer ${token}` },
    data: { titulo: 'Buraco para o mapa E2E', categoria: 'Pavimentação', endereco: 'Rua do Teste, 10', bairro: 'Centro', lat: -28.2761, lng: -49.1712, precisao: 'gps' },
  });
  await page.context().addCookies([{ name: 'urbana_token', value: token, url: 'http://localhost:3099' }]);
}

test('mapa: abre, mostra pontos, alterna para calor e filtra sem erros no console', async ({ page, request }) => {
  const erros: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  page.on('pageerror', (e) => erros.push(e.message));
  await page.route(/tile\.openstreetmap\.org/, (r) => r.fulfill({ contentType: 'image/png', body: TILE }));
  await entrar(page, request);

  await page.goto('/mapa');
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.locator('.urbana-dot, .urbana-cluster').first()).toBeVisible();

  await page.getByRole('tab', { name: 'Calor' }).click();
  await expect(page.locator('canvas.leaflet-heatmap-layer')).toBeVisible();
  await page.getByRole('tab', { name: 'Pontos' }).click();
  await expect(page.locator('.urbana-dot, .urbana-cluster').first()).toBeVisible();

  // Filtro por categoria: uma categoria sem ocorrências esvazia o mapa.
  await page.getByRole('button', { name: 'Parques' }).click();
  await expect(page.getByText('Nenhuma ocorrência com esses filtros.').first()).toBeVisible();
  expect(erros).toEqual([]);
});
