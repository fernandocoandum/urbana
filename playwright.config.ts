import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Chromium pré-instalado do ambiente de nuvem (Linux). Fora dele (ex.: Windows), usa o navegador
// do Playwright ou o canal de PW_CHANNEL (ex.: PW_CHANNEL=chrome para o Chrome instalado).
const CHROMIUM_NUVEM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// Os specs sobem o próprio servidor de produção (`next start`, porta 3099) com um banco JSON
// isolado em .tmp/e2e-db.json (apagado a cada execução) — não precisam de Postgres.
// `npm run test:e2e` roda `next build` antes.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // os specs compartilham o mesmo servidor/porta e o mesmo banco
  retries: 0,
  timeout: 120_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3099',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
    // O ambiente de nuvem já traz um Chromium numa revisão própria — sem isso o Playwright tenta
    // baixar a revisão que ele mesmo espera, e lá não há acesso de rede para isso.
    ...(existsSync(CHROMIUM_NUVEM) ? { launchOptions: { executablePath: CHROMIUM_NUVEM } } : {}),
    ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
  },
  webServer: {
    command: `node -e "require('fs').rmSync('.tmp/e2e-db.json',{force:true})" && next start -p 3099`,
    url: 'http://localhost:3099/api/config',
    env: { URBANA_DB_FILE: '.tmp/e2e-db.json', DATABASE_URL: '' },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
