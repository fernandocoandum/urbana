'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { api } from '@/lib/api-client';

/** Encerra a sessão, descarta o cache do SWR (dados do usuário anterior) e volta ao /entrar. */
export function useSair() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  return useCallback(async () => {
    try { await api('POST', '/api/logout'); } catch { /* sessão já inválida: segue */ }
    await mutate(() => true, undefined, { revalidate: false });
    router.replace('/entrar');
  }, [router, mutate]);
}
