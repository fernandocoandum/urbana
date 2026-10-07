'use client';

import { ClipboardList, Search, SearchX } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Container, PageHeader } from '@/components/layout/page';
import { AnimatedTabs, type TabItem } from '@/components/ui/animated-tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { fieldClasses } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useOcorrencias } from '../hooks';
import { OcorrenciaLista } from './ocorrencia-lista';

type Filtro = 'todas' | 'andamento' | 'resolvidas';

export function ListaView() {
  const { data, error, mutate } = useOcorrencias();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');

  const abas: TabItem[] = useMemo(() => {
    const todas = data ?? [];
    const resolvidas = todas.filter((o) => o.status === 'Resolvida').length;
    return [
      { value: 'todas', label: 'Todas', count: data ? todas.length : undefined },
      { value: 'andamento', label: 'Em andamento', count: data ? todas.length - resolvidas : undefined },
      { value: 'resolvidas', label: 'Resolvidas', count: data ? resolvidas : undefined },
    ];
  }, [data]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (data ?? []).filter((o) => {
      if (filtro === 'andamento' && o.status === 'Resolvida') return false;
      if (filtro === 'resolvidas' && o.status !== 'Resolvida') return false;
      if (!termo) return true;
      return o.titulo.toLowerCase().includes(termo) || o.protocolo.toLowerCase().includes(termo) || (o.endereco || '').toLowerCase().includes(termo);
    });
  }, [data, busca, filtro]);

  return (
    <Container>
      <PageHeader title="Minhas ocorrências" description="Acompanhe o andamento de cada registro." />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-80">
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-fg-subtle" />
          <input
            type="search"
            id="busca-ocorrencias"
            aria-label="Buscar por título, protocolo ou endereço"
            placeholder="Buscar por título ou protocolo"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className={cn(fieldClasses, 'h-12 pl-12')}
          />
        </div>
        <AnimatedTabs tabs={abas} value={filtro} onValueChange={(v) => setFiltro(v as Filtro)} aria-label="Filtrar por situação" />
      </div>

      <p className="mt-6 text-sm text-fg-muted" aria-live="polite">
        {data ? `${filtradas.length} ${filtradas.length === 1 ? 'ocorrência' : 'ocorrências'}` : 'Carregando...'}
      </p>

      <div className="mt-4">
        {error ? (
          <Card>
            <EmptyState icon={ClipboardList} title="Não foi possível carregar" description={error.message} action={<Button variant="secondary" onClick={() => mutate()}>Tentar de novo</Button>} />
          </Card>
        ) : !data ? (
          <div className="flex flex-col gap-3" aria-hidden>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)}
          </div>
        ) : data.length === 0 ? (
          <Card>
            <EmptyState
              icon={ClipboardList}
              title="Nenhuma ocorrência ainda"
              description="Encontrou um problema na sua rua? Registre e acompanhe por aqui."
              action={
                <Button asChild>
                  <Link href="/ocorrencias/nova">Registrar ocorrência</Link>
                </Button>
              }
            />
          </Card>
        ) : filtradas.length === 0 ? (
          <Card>
            <EmptyState icon={SearchX} title="Nenhuma ocorrência encontrada" description="Tente outra busca ou mude o filtro." />
          </Card>
        ) : (
          <OcorrenciaLista itens={filtradas} />
        )}
      </div>
    </Container>
  );
}
