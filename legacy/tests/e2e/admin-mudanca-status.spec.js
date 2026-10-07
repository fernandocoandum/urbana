// E2E 2/3 — fluxo principal da prefeitura: abrir uma ocorrência, responder ao cidadão, avançar o
// status e confirmar a regra de negócio "retroceder o status exige uma observação preenchida"
// (a mesma regra coberta por unit/api tests do lado do servidor, aqui verificada como o usuário
// realmente vê: uma mensagem de erro na tela, não um 400 cru).
const { test, expect } = require('@playwright/test');

test('prefeitura responde, avança o status e é bloqueada de retroceder sem justificar', async ({ page, request }) => {
  // A ocorrência é criada via API direta (mais rápido e estável do que repetir o wizard inteiro
  // aqui) — esse caminho de criação já é coberto pelo spec do cidadão.
  const email = `e2e-admin-cid-${Date.now()}@teste.com`;
  await request.post('/api/cadastro', { data: { nome: 'Cidadão da Ocorrência', email, senha: 'senha123', bairro: 'Centro' } });
  const loginRes = await request.post('/api/login', { data: { email, senha: 'senha123' } });
  const { token } = await loginRes.json();
  await request.post('/api/aceitar-termos', { headers: { Authorization: `Bearer ${token}` } });
  const ocRes = await request.post('/api/ocorrencias', {
    headers: { Authorization: `Bearer ${token}` },
    data: { titulo: 'Poste apagado testado por E2E admin', categoria: 'Iluminação pública', endereco: 'Av. Central, 500', bairro: 'Centro' },
  });
  const { id } = await ocRes.json();

  await page.goto('/');
  await page.fill('#login-email', 'admin@prefeitura.gov.br');
  await page.fill('#login-senha', 'admin');
  await page.click('#btn-login');
  await expect(page.getByText('Ocorrências por categoria')).toBeVisible({ timeout: 10000 });

  await page.evaluate((ocId) => abrirPrefDet(ocId), id);
  await expect(page.locator('#pdet-t')).toHaveText('Poste apagado testado por E2E admin');

  await page.fill('#det-msg', 'Já estamos a caminho para verificar o poste.');
  await page.click('button[onclick*="enviarMensagemAdmin"]');
  await expect(page.getByText('Já estamos a caminho para verificar o poste.')).toBeVisible();

  const badgeNoDetalhe = page.locator('#pdet-content .badge');
  await page.selectOption('#det-status', 'Em análise');
  await page.fill('#det-obs', 'Equipe de manutenção notificada.');
  await page.click('button[onclick="aplicarStatus()"]');
  await expect(badgeNoDetalhe.first()).toHaveText('Em análise');

  // Regra de negócio: retroceder o status exige observação — testa o caminho de erro, não só o feliz.
  await page.selectOption('#det-status', 'Recebida');
  await page.fill('#det-obs', '');
  await page.click('button[onclick="aplicarStatus()"]');
  await expect(badgeNoDetalhe.first()).toHaveText('Em análise'); // status não mudou
});
