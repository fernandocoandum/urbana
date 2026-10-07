'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { MiniMapaProps } from './mini-mapa';

// Leaflet usa `window`: só carrega no navegador e fora do bundle compartilhado.
const MiniMapaInner = dynamic(() => import('./mini-mapa'), {
  ssr: false,
  loading: () => <Skeleton className="h-60 w-full rounded-xl" />,
});

export function MiniMapa(props: MiniMapaProps) {
  return <MiniMapaInner {...props} className={cn(props.className)} />;
}
