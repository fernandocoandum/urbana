// Config mínima do Playwright Test — os specs em tests/e2e/ sobem o próprio servidor Urbana
// (Node) na porta 3099 antes de rodar (webServer abaixo) e usam o banco JSON local, então não
// precisam de Postgres nem de nenhuma conta pré-existente além do admin seedado pelo próprio boot.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // os specs compartilham o mesmo servidor/porta e o mesmo db.json — evita corrida entre arquivos
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3099',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
    // Este ambiente já traz um Chromium pré-instalado numa revisão própria — sem isso o
    // Playwright tenta baixar a revisão que ele mesmo espera, e não há acesso de rede para isso.
    launchOptions: { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' },
  },
  webServer: {
    command: 'node server.js',
    url: 'http://localhost:3099',
    env: { PORT: '3099' },
    reuseExistingServer: false,
    timeout: 20000,
  },
});
