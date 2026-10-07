// E2E — notificações do cidadão: o admin muda o status e responde; o sino do cidadão mostra 2,
// a lista leva ao detalhe e o contador baixa. Cidadão e IPs únicos por execução.
import { expect, test } from '@playwright/test';

const ip = () => '9.9.' + Math.floor(Math.random() * 200) + '.' + Math.floor(Math.random() * 200);

for (const mobile of [false, true]) {
  test.describe(mobile ? 'em 390×844' : 'em desktop', () => {
    if (mobile) test.use({ viewport: { width: 390, height: 844 } });

    test('sino: contador, lista, clique leva ao detalhe e o contador baixa', async ({ page, request }) => {
      const erros: string[] = [];
      page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
      page.on('pageerror', (e) => erros.push(e.message));

      const email = `e2e-notif-${Date.now()}-${Math.floor(Math.random() * 1e5)}@teste.com`;
      await request.post('/api/cadastro', { data: { nome: 'Cidadã das Notificações', email, senha: 'senha123', bairro: 'Centro' }, headers: { 'x-forwarded-for': ip() } });
      const login = await request.post('/api/login', { data: { email, senha: 'senha123' }, headers: { 'x-forwarded-for': ip() } });
      const { token } = await login.json();
      const cidadao = { Authorization: `Bearer ${token}` };
      await request.post('/api/aceitar-termos', { headers: cidadao });
      const titulo = `Lâmpada queimada notif ${mobile ? 'mobile' : 'desktop'} ${Date.now()}`;
      const criada = await request.post('/api/ocorrencias', {
        headers: cidadao,
        data: { titulo, categoria: 'Iluminação pública', endereco: 'Rua da Luz, 10', bairro: 'Centro', lat: -28.2761, lng: -49.1712, precisao: 'gps' },
      });
      const { id } = await criada.json();

      const adminLogin = await request.post('/api/login', { data: { email: 'admin@prefeitura.gov.br', senha: 'admin' }, headers: { 'x-forwarded-for': ip() } });
      const admin = { Authorization: `Bearer ${(await adminLogin.json()).token}` };
      const st = await request.put(`/api/ocorrencias/${id}/status`, { headers: admin, data: { status: 'Em atendimento', obs: 'Equipe a caminho.' } });
      expect(st.ok(), await st.text()).toBeTruthy();
      const msg = await request.post(`/api/ocorrencias/${id}/mensagens`, { headers: admin, data: { texto: 'Trocaremos a lâmpada amanhã cedo.' } });
      expect(msg.ok()).toBeTruthy();

      await page.context().addCookies([{ name: 'urbana_token', value: token, url: 'http://localhost:3099' }]);
      await page.goto('/inicio');
      const sino = page.getByRole('button', { name: /Notificações, 2 não lidas/ });
      await expect(sino).toBeVisible();
      await expect(page.getByTestId('sino-contador')).toHaveText('2');

      await sino.click();
      await expect(page.getByText('Trocaremos a lâmpada amanhã cedo.')).toBeVisible();
      await expect(page.getByText('Equipe a caminho.')).toBeVisible();
      await page.getByRole('button', { name: /A prefeitura respondeu/ }).click();
      await expect(page).toHaveURL(new RegExp(`/ocorrencias/${id}`));
      await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible();

      // Abrir o detalhe marca as notificações da ocorrência como lidas: o contador some.
      await expect(page.getByTestId('sino-contador')).toHaveCount(0);
      await page.getByRole('button', { name: 'Notificações', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Marcar todas como lidas' })).toBeDisabled();
      expect(erros).toEqual([]);
    });
  });
}
