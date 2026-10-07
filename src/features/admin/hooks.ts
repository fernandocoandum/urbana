'use client';

import useSWR from 'swr';
import type { OcorrenciaDerivada } from '@/lib/db/types';

/** Todas as ocorrências (o admin enxerga a fila inteira); atualiza sozinho a cada 30 s. */
export function useFilaAdmin() {
  return useSWR<OcorrenciaDerivada[]>('/api/ocorrencias', { refreshInterval: 30_000 });
}
