// E2E — tela de entrada: link de redefinição antigo (/?reset=), migração da sessão do localStorage
// para o cookie e recuperação de senha.
import { expect, test } from '@playwright/test';

test('/?reset=abc leva ao /entrar e abre o diálogo de redefinição', async ({ page }) => {
  await page.goto('/?reset=abc');
  await expect(page).toHaveURL(/\/entrar\?reset=abc$/);
  await expect(page.getByRole('dialog', { name: 'Definir nova senha' })).toBeVisible();
  // token inválido: o servidor responde e o erro aparece no próprio diálogo
  await page.fill('#redef-senha', 'NovaSenha#2026');
  await page.click('#redef-btn');
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
});

test('token antigo no localStorage vira cookie e entra no painel', async ({ page, request }) => {
  const login = await request.post('/api/login', { data: { email: 'admin@prefeitura.gov.br', senha: 'admin' }, headers: { 'x-forwarded-for': '7.7.7.1' } });
  const { token } = await login.json();
  await page.addInitScript((t) => localStorage.setItem('urbaniza+_session', JSON.stringify({ token: t })), token);
  await page.goto('/entrar');
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15000 });
  expect(await page.evaluate(() => localStorage.getItem('urbaniza+_session'))).toBeNull();
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === 'urbana_token')?.httpOnly).toBe(true);
});

test('token antigo inválido é apagado e a tela de entrada continua', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('urbaniza+_session', JSON.stringify({ token: 'lixo' })));
  await page.goto('/entrar');
  await expect(page.locator('#btn-login')).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('urbaniza+_session'))).toBeNull();
  await expect(page).toHaveURL(/\/entrar$/);
});

test('recuperar senha mostra a mensagem do servidor', async ({ page }) => {
  await page.goto('/entrar');
  await page.getByRole('button', { name: 'Esqueceu a senha?' }).click();
  await page.fill('#rec-email', 'ninguem@teste.com');
  await page.click('#rec-btn');
  await expect(page.getByRole('dialog').getByText('Se o e-mail existir em nossa base')).toBeVisible();
});

test('login com senha errada mostra o erro do servidor', async ({ page }) => {
  await page.goto('/entrar');
  await page.fill('#login-email', 'admin@prefeitura.gov.br');
  await page.fill('#login-senha', 'errada');
  await page.click('#btn-login');
  await expect(page.locator('#login-error')).toHaveText('E-mail ou senha incorretos.');
});
