import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      'server-only': path.resolve(import.meta.dirname, 'tests/helpers/empty.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: { NODE_ENV: 'test', URBANA_DB_FILE: '.tmp/test-db.json', DATABASE_URL: '' },
  },
});
