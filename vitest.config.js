// Sem este arquivo, o padrão de busca do Vitest (`**/*.{test,spec}.*`) também encontra os specs
// do Playwright em tests/e2e/*.spec.js e tenta rodá-los como teste unitário — o que falha na
// hora ("Playwright Test did not expect test() to be called here"), porque esses arquivos usam
// o `test`/`expect` do @playwright/test, não os do Vitest. `npm test` (Vitest) deve rodar só
// tests/*.test.js; os specs de tests/e2e/ rodam com `npm run test:e2e` (Playwright), que já usa
// playwright.config.js para localizá-los.
const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
});
