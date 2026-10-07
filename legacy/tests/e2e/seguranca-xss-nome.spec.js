// E2E 3/3 — verificação de segurança ponta a ponta: um nome de exibição contendo HTML/JS
// precisa aparecer como TEXTO na tela, nunca ser executado. Isso comprova no navegador de
// verdade o que os testes unitários/API já garantem no nível de função (esc() aplicado em
// innerHTML) — aqui é a prova de que a cadeia completa (armazenar sem sanitizar → escapar só na
// hora de exibir) realmente funciona no DOM renderizado, e não só na lógica isolada.
//
// O payload usa onerror (não alert()) de propósito: se a escapagem falhar e o HTML for
// interpretado de verdade, ele seta uma flag em window silenciosamente, sem abrir nenhum dialog
// do navegador — um alert() travaria a página e o teste.
const { test, expect } = require('@playwright/test');

test('nome de exibição com payload de XSS é renderizado como texto, nunca executado', async ({ page }) => {
  const email = `e2e-xss-${Date.now()}@teste.com`;
  const payload = '<img src=x onerror="window.__xssFired = true">';

  await page.goto('/');
  await page.click('#tab-cadastro');
  await page.fill('#cad-nome', payload);
  await page.fill('#cad-email', email);
  await page.fill('#cad-senha', 'senha123');
  await page.selectOption('#cad-bairro', 'Centro');
  await page.click('#btn-cad');

  await page.fill('#login-email', email);
  await page.fill('#login-senha', 'senha123');
  await page.click('#btn-login');
  await page.click('#termos-btn-aceitar');

  await page.click('text=Meu Perfil');
  await expect(page.locator('#perfil-nome-display')).toBeVisible({ timeout: 10000 });

  // 1) o payload aparece como texto literal na tela (escapado), não como uma tag de verdade
  await expect(page.locator('#perfil-nome-display')).toHaveText(payload);

  // 2) o onerror NUNCA disparou — se tivesse, o HTML teria sido interpretado de verdade
  const xssExecutou = await page.evaluate(() => window.__xssFired === true);
  expect(xssExecutou).toBe(false);

  // 3) confere que não existe nenhuma tag <img> de verdade dentro do card de perfil por causa
  // desse nome (só pode existir a <img> do avatar de foto, que não é o caso aqui — sem foto
  // cadastrada, o avatar é o círculo de iniciais, não uma <img>)
  const imgsNoCardDeNome = await page.locator('#perfil-nome-display img').count();
  expect(imgsNoCardDeNome).toBe(0);
});
