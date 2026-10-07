// E2E — segurança ponta a ponta: um nome de exibição com HTML/JS precisa aparecer como TEXTO na
// tela (/perfil), nunca ser executado. O payload usa onerror (não alert()) de propósito: se o
// escape falhasse, ele setaria uma flag em window sem abrir nenhum dialog que travaria o teste.
import { expect, test } from '@playwright/test';

declare global {
  interface Window { __xssFired?: boolean }
}

test('nome de exibição com payload de XSS é renderizado como texto, nunca executado', async ({ page }) => {
  const email = `e2e-xss-${Date.now()}@teste.com`;
  const payload = '<img src=x onerror="window.__xssFired = true">';

  await page.goto('/entrar');
  await page.click('#tab-cadastro');
  await page.fill('#cad-nome', payload);
  await page.fill('#cad-email', email);
  await page.fill('#cad-senha', 'senha123');
  await page.selectOption('#cad-bairro', 'Centro');
  await page.click('#btn-cad');

  await expect(page.locator('#login-email')).toHaveValue(email);
  await page.fill('#login-senha', 'senha123');
  await page.click('#btn-login');
  await page.click('#termos-btn-aceitar');
  await expect(page.locator('#termos-modal')).toBeHidden();

  await page.goto('/perfil');
  await expect(page.locator('#perfil-nome-display')).toBeVisible({ timeout: 10000 });

  // 1) o payload aparece como texto literal (escapado), não como uma tag de verdade
  await expect(page.locator('#perfil-nome-display')).toHaveText(payload);

  // 2) o onerror NUNCA disparou
  expect(await page.evaluate(() => window.__xssFired === true)).toBe(false);

  // 3) nenhuma <img> de verdade dentro do nome
  expect(await page.locator('#perfil-nome-display img').count()).toBe(0);

  // o mesmo vale no cabeçalho do menu do usuário e no diálogo de edição (campo preenchido com o texto)
  await page.getByRole('button', { name: 'Editar perfil' }).click();
  await expect(page.locator('#perfil-nome-input')).toHaveValue(payload.slice(0, 60));
  expect(await page.evaluate(() => window.__xssFired === true)).toBe(false);
});
