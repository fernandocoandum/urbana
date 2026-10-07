import { env } from '@/lib/env';
import { JsonDb } from './json';
import { PgDb } from './postgres';
import { DbUnavailable, type Db } from './types';

export { DbUnavailable } from './types';
export type { Db } from './types';

declare global {
  var __urbanaDb: Db | undefined;
  var __urbanaDbInit: Promise<Db> | undefined;
}

async function initDb(): Promise<Db> {
  if (env.DATABASE_URL) {
    try {
      return await PgDb.init();
    } catch (e) {
      // Em produção (DATABASE_URL configurado), uma falha do Postgres NÃO cai silenciosamente
      // para persistência JSON local — em hospedagem serverless o disco não é confiável, e o
      // operador precisa saber que o banco está fora do ar. A próxima chamada tenta de novo.
      const msg = e instanceof Error ? e.message : String(e);
      console.error('ERRO CRÍTICO: falha ao conectar/inicializar o PostgreSQL:', msg);
      console.error('O servidor está de pé, mas a API responderá 503 até o banco voltar a ficar saudável.');
      throw new DbUnavailable(msg);
    }
  }
  return JsonDb.init();
}

/** Singleton em globalThis (sobrevive ao HMR) com init preguiçoso — nunca no import nem no build. */
export async function getDb(): Promise<Db> {
  if (globalThis.__urbanaDb) return globalThis.__urbanaDb;
  if (!globalThis.__urbanaDbInit) {
    globalThis.__urbanaDbInit = initDb()
      .then((db) => { globalThis.__urbanaDb = db; return db; })
      .finally(() => { globalThis.__urbanaDbInit = undefined; });
  }
  return globalThis.__urbanaDbInit;
}
