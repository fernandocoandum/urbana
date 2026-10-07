'use client';

import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { setUnauthorizedHandler } from '@/lib/api-client';

/** Usuário entregue pelo layout (Server Component) ao cliente — nunca inclui senha/tokens. */
export interface SessionUser {
  id: string;
  nome: string;
  email: string;
  role: string;
  bairro: string;
  foto: string | null;
  termosAceitos: boolean;
  criadoEm: string | null;
}

const Ctx = createContext<SessionUser | null>(null);

export function SessionProvider({ user, children }: { user: SessionUser; children: ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    setUnauthorizedHandler((path) => router.replace(path));
    return () => setUnauthorizedHandler(null);
  }, [router]);
  return <Ctx.Provider value={user}>{children}</Ctx.Provider>;
}

export function useSession(): SessionUser {
  const u = useContext(Ctx);
  if (!u) throw new Error('useSession fora do SessionProvider');
  return u;
}
