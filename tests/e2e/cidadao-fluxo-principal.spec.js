// E2E 1/3 — fluxo principal do cidadão: cadastro → login → aceitar termos → registrar uma
// ocorrência pelo wizard → ver protocolo → encontrar a ocorrência em "Minhas Ocorrências".
// É o caminho que praticamente todo usuário real percorre; se ele quebrar, o app não serve.
const { test, expect } = require('@playwright/test');

test('cidadão se cadastra, loga, aceita os termos e registra uma ocorrência', async ({ page }) => {
  const email = `e2e-cidadao-${Date.now()}@teste.com`;

  await page.goto('/');
  await page.click('#tab-cadastro');
  await page.fill('#cad-nome', 'Cidadão E2E');
  await page.fill('#cad-email', email);
  await page.fill('#cad-senha', 'senha123');
  await page.selectOption('#cad-bairro', 'Centro');
  await page.click('#btn-cad');

  await page.fill('#login-email', email);
  await page.fill('#login-senha', 'senha123');
  await page.click('#btn-login');

  await expect(page.locator('#termos-modal')).toHaveClass(/show/, { timeout: 10000 });
  await page.click('#termos-btn-aceitar');

  await expect(page.getByText('Suas ocorrências recentes')).toBeVisible({ timeout: 10000 });

  await page.click('text=Nova Ocorrência');
  await page.click('.wz-cat-card[data-cat="Pavimentação"]');
  await page.selectOption('#f-bairro', 'Centro');
  await page.fill('#f-endereco', 'Rua dos Testes, 42');
  await page.click('#wz-btn-next');
  await page.fill('#f-titulo', 'Buraco enorme testado por E2E');
  await page.fill('#f-descricao', 'Descrição registrada pelo teste automatizado.');
  await page.click('#wz-btn-next');
  await expect(page.locator('#wz-review')).toContainText('Buraco enorme testado por E2E');
  await page.click('#wz-btn-next');

  await expect(page.getByText(/PROT-\d{4}-\d{4}/)).toBeVisible({ timeout: 10000 });

  await page.click('text=Ver minhas ocorrências');
  await expect(page.locator('.ocorr-card', { hasText: 'Buraco enorme testado por E2E' })).toBeVisible();
});
