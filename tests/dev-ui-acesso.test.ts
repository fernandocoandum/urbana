import { describe, expect, it } from 'vitest';
import { vitrineLiberada } from '@/app/dev/ui/acesso';

describe('vitrineLiberada (/dev/ui)', () => {
  it('em produção na Vercel é sempre 404, mesmo com URBANA_DEV_UI=1', () => {
    expect(vitrineLiberada({ NODE_ENV: 'production', VERCEL_ENV: 'production' })).toBe(false);
    expect(vitrineLiberada({ NODE_ENV: 'production', VERCEL_ENV: 'production', URBANA_DEV_UI: '1' })).toBe(false);
    expect(vitrineLiberada({ NODE_ENV: 'development', VERCEL_ENV: 'production', URBANA_DEV_UI: '1' })).toBe(false);
  });
  it('com next start sem a variável é 404; com URBANA_DEV_UI=1 libera', () => {
    expect(vitrineLiberada({ NODE_ENV: 'production' })).toBe(false);
    expect(vitrineLiberada({ NODE_ENV: 'production', URBANA_DEV_UI: '1' })).toBe(true);
  });
  it('em desenvolvimento libera; preview da Vercel roda build de produção, então só com a variável', () => {
    expect(vitrineLiberada({ NODE_ENV: 'development' })).toBe(true);
    expect(vitrineLiberada({ NODE_ENV: 'production', VERCEL_ENV: 'preview' })).toBe(false);
    expect(vitrineLiberada({ NODE_ENV: 'production', VERCEL_ENV: 'preview', URBANA_DEV_UI: '1' })).toBe(true);
  });
});
