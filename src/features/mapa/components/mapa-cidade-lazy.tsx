'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import type { MapaCidadeProps } from './mapa-cidade';

// Leaflet + plugins só entram no navegador e fora do bundle compartilhado.
const MapaCidadeInner = dynamic(() => import('./mapa-cidade'), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

export function MapaCidade(props: MapaCidadeProps) {
  return <MapaCidadeInner {...props} />;
}
