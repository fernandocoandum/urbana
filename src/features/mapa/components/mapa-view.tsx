'use client';

import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Loader2, SlidersHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { api, ApiError } from '@/lib/api-client';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { FILTROS_PADRAO, filtrarPontos, rankingBairros, type BairroRank, type FiltrosMapa, type PontoMapa } from '../mapa-utils';
import type { ModoMapa } from './mapa-cidade';
import { MapaCidade } from './mapa-cidade-lazy';
import { PainelConteudo } from './mapa-painel';

/** Tela do mapa (cidadão em /mapa e admin em /admin/mapa): o mapa ocupa a área abaixo do header. */
export function MapaView({ admin }: { admin: boolean }) {
  const router = useRouter();
  const { data, error, mutate } = useSWR<PontoMapa[]>('/api/mapa', { refreshInterval: 60000 });
  const [filtros, setFiltros] = useState<FiltrosMapa>(FILTROS_PADRAO);
  const [modo, setModo] = useState<ModoMapa>('pontos');
  const [foco, setFoco] = useState<{ centro: [number, number]; nonce: number } | null>(null);
  const [painelAberto, setPainelAberto] = useState(true);
  const [sheetAberto, setSheetAberto] = useState(false);
  // Apoios dados no popup: guardados à parte para o popup aberto não ser recriado a cada clique.
  const [overrides] = useState(() => new Map<string, { apoiado: boolean; total: number }>());

  const base = useMemo(
    () => (data ?? []).map((p) => { const o = overrides.get(p.id); return o ? { ...p, apoiado: o.apoiado, apoios: o.total } : p; }),
    [data, overrides],
  );
  const filtrados = useMemo(() => filtrarPontos(base, filtros), [base, filtros]);
  const ranking = useMemo(() => rankingBairros(filtrados, 5), [filtrados]);
  const filtrosAtivos = filtros.categorias.length + (filtros.status !== 'todos' ? 1 : 0) + (filtros.soMinhas ? 1 : 0);

  const verDetalhes = useCallback((id: string) => router.push(admin ? `/admin/ocorrencias/${id}` : `/ocorrencias/${id}`), [router, admin]);
  const apoiar = useCallback(async (id: string) => {
    try {
      const r = await api<{ apoiado: boolean; total: number }>('POST', `/api/ocorrencias/${encodeURIComponent(id)}/apoiar`);
      overrides.set(id, r);
      toast.success(r.apoiado ? 'Você apoiou essa ocorrência!' : 'Apoio removido.');
      return r;
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Não foi possível apoiar agora.');
      return null;
    }
  }, [overrides]);
  const irParaBairro = (b: BairroRank) => {
    setFoco({ centro: b.centro, nonce: Date.now() });
    setSheetAberto(false);
  };

  const painel = (
    <PainelConteudo filtros={filtros} onFiltros={setFiltros} modo={modo} onModo={setModo} admin={admin} ranking={ranking} onBairro={irParaBairro} />
  );
  const resumo = !data ? 'Carregando…' : `${filtrados.length} ${filtrados.length === 1 ? 'ocorrência' : 'ocorrências'}`;

  return (
    <div className={cn('relative overflow-hidden', admin ? 'h-[calc(100dvh-64px)]' : 'h-[calc(100dvh-64px-72px-env(safe-area-inset-bottom))] md:h-[calc(100dvh-64px)]')}>
      <h1 className="sr-only">Mapa da cidade</h1>
      <MapaCidade pontos={filtrados} modo={modo} admin={admin} foco={foco} onVerDetalhes={verDetalhes} onApoiar={apoiar} />

      {/* Desktop: card flutuante de 320px, recolhível. */}
      <motion.section
        aria-label="Filtros do mapa"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring.smooth}
        className="absolute left-4 top-4 z-10 hidden max-h-[calc(100%-32px)] w-80 flex-col overflow-hidden rounded-2xl border border-border/70 bg-surface/95 shadow-lg backdrop-blur-md md:flex"
      >
        <button
          type="button"
          onClick={() => setPainelAberto((a) => !a)}
          aria-expanded={painelAberto}
          className="flex h-14 shrink-0 items-center justify-between gap-3 px-5 text-left outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-primary/25"
        >
          <span>
            <span className="block text-base font-semibold leading-5">Mapa da cidade</span>
            <span className="tabular block text-sm leading-5 text-fg-muted" aria-live="polite">{resumo}</span>
          </span>
          <ChevronDown aria-hidden className={cn('size-5 text-fg-muted transition-transform duration-200', painelAberto && 'rotate-180')} />
        </button>
        <AnimatePresence initial={false}>
          {painelAberto && (
            <motion.div
              key="corpo"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={spring.smooth}
              className="min-h-0 overflow-y-auto"
            >
              <div className="px-5 pb-5 pt-1">{painel}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      {/* Mobile: um botão pequeno abre o Sheet inferior, e o mapa fica livre. */}
      <div className="absolute left-3 top-3 z-10 md:hidden">
        <Sheet open={sheetAberto} onOpenChange={setSheetAberto}>
          <SheetTrigger asChild>
            <Button variant="secondary" className="h-11 rounded-full border border-border/70 bg-surface/95 px-4 shadow-md backdrop-blur-md hover:bg-surface">
              <SlidersHorizontal aria-hidden className="!size-4" />
              Filtros
              {filtrosAtivos > 0 && <span className="tabular grid size-5 place-items-center rounded-full bg-primary text-caption font-medium text-primary-fg">{filtrosAtivos}</span>}
              <span className="tabular text-fg-muted">· {resumo}</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" title="Filtros do mapa" description={resumo} className="max-h-[78dvh]">
            {painel}
          </SheetContent>
        </Sheet>
      </div>

      {!data && !error && (
        <div role="status" className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium shadow-md max-md:top-[68px]">
          <Loader2 className="size-4 animate-spin text-primary" aria-hidden /> Carregando ocorrências…
        </div>
      )}
      {error && (
        <div role="alert" className="absolute left-1/2 top-4 z-10 flex w-[min(92%,420px)] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm max-md:top-[68px]">
          <span>Não foi possível carregar o mapa. {error.message}</span>
          <Button size="sm" variant="secondary" onClick={() => mutate()}>Tentar de novo</Button>
        </div>
      )}
      {data && filtrados.length === 0 && (
        <div role="status" className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border bg-surface px-4 py-2 text-sm text-fg-muted shadow-md">
          Nenhuma ocorrência com esses filtros.
        </div>
      )}
    </div>
  );
}
