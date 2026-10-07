// E2E 1/3 — fluxo principal do cidadão: cadastro → login → aceitar termos → registrar uma
// ocorrência pelo wizard → ver protocolo → encontrar a ocorrência em "Minhas ocorrências".
// É o caminho que praticamente todo usuário real percorre; se ele quebrar, o app não serve.
import { expect, test } from '@playwright/test';

test('cidadão se cadastra, loga, aceita os termos e registra uma ocorrência', async ({ page }) => {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));

  const email = `e2e-cidadao-${Date.now()}@teste.com`;

  await page.goto('/'); // sem sessão: /entrar
  await expect(page).toHaveURL(/\/entrar$/);
  await page.click('#tab-cadastro');
  await page.fill('#cad-nome', 'Cidadão E2E');
  await page.fill('#cad-email', email);
  await page.fill('#cad-senha', 'senha123');
  await page.selectOption('#cad-bairro', 'Centro');
  await page.click('#btn-cad');

  // depois do cadastro a aba de login abre com o e-mail preenchido
  await expect(page.locator('#login-email')).toHaveValue(email);
  await page.fill('#login-senha', 'senha123');
  await page.click('#btn-login');

  await expect(page.locator('#termos-modal')).toBeVisible({ timeout: 10000 });
  await page.click('#termos-btn-aceitar');
  await expect(page.locator('#termos-modal')).toBeHidden();

  await expect(page.getByText('Suas ocorrências recentes')).toBeVisible({ timeout: 10000 });

  await page.getByRole('link', { name: 'Registrar ocorrência' }).click();
  await page.click('[data-cat="Pavimentação"]');
  await page.selectOption('#f-bairro', 'Centro');
  await page.fill('#f-endereco', 'Rua dos Testes, 42');
  await page.click('#wz-btn-next');
  await page.fill('#f-titulo', 'Buraco enorme testado por E2E');
  await page.fill('#f-descricao', 'Descrição registrada pelo teste automatizado.');
  await page.click('#wz-btn-next');
  await expect(page.locator('#wz-review')).toContainText('Buraco enorme testado por E2E');
  await page.click('#wz-btn-next');

  await expect(page.locator('#proto-gerado')).toHaveText(/PROT-\d{4}-\d{4}/, { timeout: 10000 });

  await page.getByRole('link', { name: 'Ver minhas ocorrências' }).click();
  await expect(page.getByTestId('ocorrencia-card').filter({ hasText: 'Buraco enorme testado por E2E' })).toBeVisible();

  // abre o detalhe: título, protocolo e conversa
  await page.getByTestId('ocorrencia-card').filter({ hasText: 'Buraco enorme testado por E2E' }).click();
  await expect(page.getByRole('heading', { name: 'Buraco enorme testado por E2E' })).toBeVisible();
  await expect(page.getByText('Conversa com a prefeitura')).toBeVisible();

  expect(erros).toEqual([]);
});
