'use client';

import useSWR from 'swr';
import type { OcorrenciaDerivada } from '@/lib/db/types';

/** Ocorrências do cidadão logado (a API filtra por dono). */
export function useOcorrencias() {
  return useSWR<OcorrenciaDerivada[]>('/api/ocorrencias');
}

export function useOcorrencia(id: string) {
  return useSWR<OcorrenciaDerivada>(`/api/ocorrencias/${encodeURIComponent(id)}`);
}
