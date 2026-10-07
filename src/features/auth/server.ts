import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/constants';
import { getUserByToken } from './session';
import type { SessionUser } from './session-context';

/** Usuário da sessão atual, para Server Components e layouts (lê o cookie via next/headers). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = await getUserByToken(token);
  if (!user) return null;
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    role: user.role,
    bairro: user.bairro || '',
    foto: user.foto || null,
    termosAceitos: !!user.termosAceitosEm,
    criadoEm: user.criadoEm ? new Date(user.criadoEm).toISOString() : null,
  };
});
