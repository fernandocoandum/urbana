// E2E — perfil (abas, edição) e conversa da cidade (envio otimista) com um morador novo.
import { expect, test } from '@playwright/test';

async function entrar(page: import('@playwright/test').Page, request: import('@playwright/test').APIRequestContext, nome: string) {
  const email = `e2e-pc-${Date.now()}-${Math.floor(Math.random() * 1e4)}@teste.com`;
  const cad = await request.post('/api/cadastro', { data: { nome, email, senha: 'senha123', bairro: 'Centro' }, headers: { 'x-forwarded-for': '8.8.8.' + Math.floor(Math.random() * 200) } });
  expect(cad.ok()).toBeTruthy();
  const login = await request.post('/api/login', { data: { email, senha: 'senha123' }, headers: { 'x-forwarded-for': '8.8.9.' + Math.floor(Math.random() * 200) } });
  const { token } = await login.json();
  await page.context().addCookies([{ name: 'urbana_token', value: token, url: 'http://localhost:3099' }]);
  await request.post('/api/aceitar-termos', { headers: { Authorization: `Bearer ${token}` } });
  return { token, email };
}

test('perfil: card, abas e edição do nome', async ({ page, request }) => {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await entrar(page, request, 'Marina Teste');
  await page.goto('/perfil');
  await expect(page.locator('#perfil-nome-display')).toHaveText('Marina Teste');
  await expect(page.getByText('Cidadão iniciante')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Conquistas' })).toBeVisible();

  await page.getByRole('tab', { name: 'Progresso' }).click();
  await expect(page.getByText('Como pontuar')).toBeVisible();
  await page.getByRole('tab', { name: 'Conta' }).click();
  await expect(page.getByText('Aparência')).toBeVisible();

  await page.getByRole('button', { name: 'Editar perfil' }).click();
  await page.fill('#perfil-nome-input', 'Marina Souza');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.locator('#perfil-nome-display')).toHaveText('Marina Souza');
  expect(erros).toEqual([]);
});

test('conversa: mensagem enviada aparece na hora e persiste', async ({ page, request }) => {
  await entrar(page, request, 'Paulo Conversa');
  await page.goto('/conversa');
  await expect(page.getByRole('heading', { name: 'Conversa da cidade' })).toBeVisible();
  const texto = `Bom dia, vizinhos! ${Date.now()}`;
  await page.fill('#chat-input', texto);
  await page.keyboard.press('Enter');
  await expect(page.getByText(texto)).toBeVisible();
  await expect(page.locator('#chat-input')).toHaveValue('');
  await page.reload();
  await expect(page.getByText(texto)).toBeVisible();
});
