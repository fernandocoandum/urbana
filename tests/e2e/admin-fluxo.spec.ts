// E2E — painel admin: visão geral com gráficos, fila com filtros na URL e gestão da ocorrência
// (encaminhar, resolver com evidência obrigatória, conversa, retroceder com justificativa),
// em desktop e em 390×844. O cidadão é criado pela API; e-mails e IPs são únicos por execução.
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const ip = () => '8.8.' + Math.floor(Math.random() * 200) + '.' + Math.floor(Math.random() * 200);
const TILE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function prepararCenario(request: APIRequestContext, titulo: string) {
  const email = `e2e-admin-${Date.now()}-${Math.floor(Math.random() * 1e5)}@teste.com`;
  await request.post('/api/cadastro', { data: { nome: 'Cidadã do Fluxo', email, senha: 'senha123', bairro: 'Centro' }, headers: { 'x-forwarded-for': ip() } });
  const login = await request.post('/api/login', { data: { email, senha: 'senha123' }, headers: { 'x-forwarded-for': ip() } });
  const { token } = await login.json();
  const auth = { Authorization: `Bearer ${token}` };
  await request.post('/api/aceitar-termos', { headers: auth });
  const criada = await request.post('/api/ocorrencias', {
    headers: auth,
    data: { titulo, categoria: 'Pavimentação', endereco: 'Rua do Fluxo, 100', bairro: 'Centro', lat: -28.2761, lng: -49.1712, precisao: 'gps' },
  });
  const { id } = await criada.json();
  // A mensagem do cidadão deixa a ocorrência "não lida" para o admin.
  await request.post(`/api/ocorrencias/${id}/mensagens`, { headers: auth, data: { texto: 'Por favor, olhem isso logo.' } });
  return { id, titulo };
}

async function entrarComoAdmin(page: Page, request: APIRequestContext) {
  const login = await request.post('/api/login', { data: { email: 'admin@prefeitura.gov.br', senha: 'admin' }, headers: { 'x-forwarded-for': ip() } });
  const { token } = await login.json();
  await page.context().addCookies([{ name: 'urbana_token', value: token, url: 'http://localhost:3099' }]);
}

function coletarErros(page: Page) {
  const erros: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  page.on('pageerror', (e) => erros.push(e.message));
  return erros;
}

async function percorrer(page: Page, request: APIRequestContext, mobile: boolean) {
  const erros = coletarErros(page);
  await page.route(/tile\.openstreetmap\.org/, (r) => r.fulfill({ contentType: 'image/png', body: TILE }));
  const titulo = `Buraco do fluxo admin ${mobile ? 'mobile' : 'desktop'} ${Date.now()}`;
  await prepararCenario(request, titulo);
  await entrarComoAdmin(page, request);

  // Visão geral: indicadores e os três gráficos.
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
  await expect(page.getByTestId('indicador-total')).toBeVisible();
  await expect(page.locator('.recharts-wrapper')).toHaveCount(3);
  await expect(page.getByRole('link', { name: /Não lidas/ })).toBeVisible();

  // Fila: o chip "Não lidas" filtra e grava na URL; a ocorrência aparece.
  await page.goto('/admin/ocorrencias');
  await expect(page.getByRole('heading', { name: 'Ocorrências' })).toBeVisible();
  await page.getByRole('button', { name: /Não lidas/ }).click();
  await expect(page).toHaveURL(/naolidas=1/);
  const item = page.getByTestId('fila-item').filter({ hasText: titulo });
  await expect(item).toBeVisible();
  // Busca por título também funciona e vai para a URL.
  await page.getByLabel('Buscar por protocolo, título, endereço ou cidadão').fill('zzz-nada');
  await expect(page.getByText('Nada encontrado')).toBeVisible();
  await page.getByRole('button', { name: 'Limpar filtros' }).first().click();
  await expect(page).not.toHaveURL(/busca=|naolidas=/);

  // Detalhe: abre pelo item da fila.
  await page.getByLabel('Buscar por protocolo, título, endereço ou cidadão').fill(titulo);
  await expect(page).toHaveURL(/busca=/);
  await page.getByTestId('fila-item').filter({ hasText: titulo }).getByText(titulo).click();
  await expect(page).toHaveURL(/\/admin\/ocorrencias\/.+/);
  await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible();
  const badge = page.getByTestId('status-badge').first();
  await expect(badge).toHaveText('Recebida');

  // Encaminhar ao setor.
  await page.getByRole('tab', { name: 'Encaminhar' }).click();
  await page.locator('#gestao-setor').selectOption('Secretaria de Obras');
  await page.getByRole('button', { name: 'Encaminhar', exact: true }).click();
  await expect(badge).toHaveText('Encaminhada');

  // Resolver sem evidência: o erro aparece e nada muda.
  await page.getByRole('tab', { name: 'Status' }).click();
  await page.locator('#gestao-status').selectOption('Resolvida');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /evidência/i })).toBeVisible();
  await expect(badge).toHaveText('Encaminhada');

  // Com evidência, resolve.
  await page.locator('#gestao-evidencia').fill('Buraco tapado com massa asfáltica.');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(badge).toHaveText('Resolvida');

  // Conversa: a resposta aparece no fio.
  await page.getByRole('tab', { name: /Conversa/ }).click();
  await page.locator('#gestao-msg-input').fill('Equipe esteve no local, obrigado pelo aviso.');
  await page.getByTestId('gestao-msg-enviar').click();
  // (por um instante a bolha otimista e a mensagem salva coexistem; fica uma só)
  await expect(page.getByRole('log').getByText('Equipe esteve no local, obrigado pelo aviso.')).toHaveCount(1);

  // Retroceder sem justificativa é barrado; com justificativa passa.
  await page.getByRole('tab', { name: 'Status' }).click();
  await page.locator('#gestao-status').selectOption('Em atendimento');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /justificativa/i })).toBeVisible();
  await expect(badge).toHaveText('Resolvida');
  await page.locator('#gestao-obs').fill('O defeito voltou a aparecer.');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(badge).toHaveText('Em atendimento');

  // "Marcar resolvida" abre o diálogo e exige evidência.
  await page.getByRole('button', { name: 'Marcar resolvida' }).first().click();
  const dialogo = page.getByRole('dialog', { name: 'Marcar como resolvida' });
  await dialogo.getByRole('button', { name: 'Marcar resolvida' }).click();
  await expect(dialogo.getByRole('alert')).toContainText(/evidência/i);
  await dialogo.locator('#resolver-evidencia').fill('Reparo refeito e testado.');
  await dialogo.getByRole('button', { name: 'Marcar resolvida' }).click();
  await expect(badge).toHaveText('Resolvida');

  // Sem rolagem horizontal da página (principalmente no celular).
  const larguras = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, janela: window.innerWidth }));
  expect(larguras.doc).toBeLessThanOrEqual(larguras.janela);
  expect(erros).toEqual([]);
}

test('admin: visão geral, fila e gestão da ocorrência (desktop)', async ({ page, request }) => {
  await percorrer(page, request, false);
});

test.describe('em 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('admin: visão geral, fila e gestão da ocorrência (celular)', async ({ page, request }) => {
    await percorrer(page, request, true);
  });

  test('admin: busca do header abre no celular e leva à fila', async ({ page, request }) => {
    await entrarComoAdmin(page, request);
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await page.getByRole('searchbox').or(page.getByLabel('Buscar por protocolo', { exact: true })).first().fill('PROT-2026-0001');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/admin\/ocorrencias\?busca=PROT-2026-0001/);
    await expect(page.getByLabel('Buscar por protocolo, título, endereço ou cidadão')).toHaveValue('PROT-2026-0001');
  });
});
