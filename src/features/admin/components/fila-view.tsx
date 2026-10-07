'use client';

import { BellRing, ClipboardList, Search, SearchX, TriangleAlert, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMediaQuery } from 'usehooks-ts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CategoryIcon } from '@/components/ui/category-icon';
import { EmptyState } from '@/components/ui/empty-state';
import { fieldClasses, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { BAIRROS, categoriaInfo, CATEGORIAS, STATUS_LISTA } from '@/features/ocorrencias/categorias';
import { pedidoPendente } from '@/features/ocorrencias/proxima-acao';
import type { OcorrenciaDerivada } from '@/lib/db/types';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { filtrarFila, filtrosDeSearchParams, ORDEM_ROTULO, ORDENS, ordenarFila, searchParamsDeFiltros, type FiltrosFila, type OrdemFila } from '../fila';
import { useFilaAdmin } from '../hooks';
import { BarraCriticidade, OcorrenciaAdminCard, textoDiasAberto } from './ocorrencia-admin-card';

type ChaveChip = 'soAtrasadas' | 'soNaoLidas' | 'comReabertura';

function Chip({ ativo, onClick, icone: Icone, children, contagem }: { ativo: boolean; onClick: () => void; icone: typeof BellRing; children: string; contagem: number }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cn(
        'inline-flex h-11 items-center gap-2 rounded-full border-2 px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-4 focus-visible:ring-primary/25',
        ativo ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg',
      )}
    >
      <Icone className="size-4" aria-hidden />
      {children}
      <span className={cn('tabular min-w-6 rounded-full px-1.5 text-center', ativo ? 'bg-primary/15' : 'bg-surface-2')}>{contagem}</span>
    </button>
  );
}

function Tabela({ itens }: { itens: OcorrenciaDerivada[] }) {
  const router = useRouter();
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
      <table className="w-full text-left text-sm" data-testid="fila-tabela">
        <caption className="sr-only">Fila de ocorrências</caption>
        <thead className="bg-surface-2 text-fg-muted">
          <tr>
            <th scope="col" className="px-5 py-3.5 whitespace-nowrap font-medium">Protocolo</th>
            <th scope="col" className="px-3 py-3.5 whitespace-nowrap font-medium">Ocorrência</th>
            <th scope="col" className="hidden px-3 py-3.5 whitespace-nowrap font-medium 2xl:table-cell">Categoria</th>
            <th scope="col" className="px-3 py-3.5 whitespace-nowrap font-medium">Aberta há</th>
            <th scope="col" className="px-3 py-3.5 whitespace-nowrap font-medium">Prazo</th>
            <th scope="col" className="px-3 py-3.5 whitespace-nowrap font-medium">Status</th>
            <th scope="col" className="hidden px-5 py-3.5 whitespace-nowrap font-medium 2xl:table-cell">Criticidade</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((o) => (
            <tr
              key={o.id}
              data-testid="fila-item"
              onClick={() => router.push(`/admin/ocorrencias/${o.id}`)}
              className="cursor-pointer border-t border-border transition-colors hover:bg-surface-2/60"
            >
              <td className="px-5 py-4 align-middle">
                <span className="flex items-center gap-2.5">
                  <span className={cn('size-2.5 shrink-0 rounded-full', o.naoLidoAdmin ? 'bg-primary' : 'bg-transparent')}>
                    {o.naoLidoAdmin && <span className="sr-only">Não lida</span>}
                  </span>
                  <span className="font-protocol whitespace-nowrap text-fg-muted">{o.protocolo}</span>
                </span>
              </td>
              <td className="max-w-[320px] px-3 py-4 align-middle">
                <Link
                  href={`/admin/ocorrencias/${o.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="block truncate rounded-sm text-base font-semibold outline-none hover:text-primary focus-visible:ring-4 focus-visible:ring-primary/25"
                >
                  {o.titulo}
                </Link>
                <span className="mt-0.5 flex items-center gap-2 truncate text-fg-muted">
                  {o.nomeUsuario || 'Cidadão'} · {o.bairro}
                  {pedidoPendente(o) && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-caption font-medium text-warning">
                      <TriangleAlert className="size-3" aria-hidden /> Reabertura
                    </span>
                  )}
                </span>
              </td>
              <td className="hidden px-3 py-4 align-middle 2xl:table-cell">
                <span className="flex items-center gap-2.5 whitespace-nowrap">
                  <CategoryIcon categoria={o.categoria} size="sm" />
                  {categoriaInfo(o.categoria).curta}
                </span>
              </td>
              <td className="tabular whitespace-nowrap px-3 py-4 align-middle text-fg-muted">{textoDiasAberto(o.diasAberto)}</td>
              <td className={cn('tabular whitespace-nowrap px-3 py-4 align-middle', o.atrasada ? 'font-medium text-danger' : 'text-fg-muted')}>
                {o.prazo && o.status !== 'Resolvida' ? fmtDate(o.prazo) : '–'}
                {o.atrasada && <span className="sr-only"> (atrasada)</span>}
              </td>
              <td className="px-3 py-4 align-middle"><StatusBadge status={o.status} /></td>
              <td className="hidden px-5 py-4 align-middle 2xl:table-cell">{o.status === 'Resolvida' ? <span className="text-fg-subtle">–</span> : <BarraCriticidade o={o} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FilaView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { data, error, mutate } = useFilaAdmin();
  const desktop = useMediaQuery('(min-width: 1024px)', { initializeWithValue: false, defaultValue: false });

  // A URL é a fonte da verdade dos filtros (link compartilhável; o header já empurra ?busca=).
  const { filtros, ordem } = useMemo(() => filtrosDeSearchParams(params), [params]);

  const [buscaLocal, setBuscaLocal] = useState(filtros.busca);
  const ultimaBuscaEnviada = useRef(filtros.busca);
  // Busca vinda de fora (header): atualiza o campo; o que a própria pessoa digitou não é sobrescrito.
  useEffect(() => {
    if (filtros.busca !== ultimaBuscaEnviada.current) {
      ultimaBuscaEnviada.current = filtros.busca;
      setBuscaLocal(filtros.busca);
    }
  }, [filtros.busca]);

  function aplicar(novos: Partial<FiltrosFila>, novaOrdem: OrdemFila = ordem) {
    const sp = searchParamsDeFiltros({ ...filtros, ...novos }, novaOrdem).toString();
    router.replace(sp ? `${pathname}?${sp}` : pathname, { scroll: false });
  }

  // Debounce da busca: 250 ms depois da última tecla.
  useEffect(() => {
    if (buscaLocal.trim() === filtros.busca) return;
    const t = setTimeout(() => {
      ultimaBuscaEnviada.current = buscaLocal.trim();
      const sp = searchParamsDeFiltros({ ...filtros, busca: buscaLocal }, ordem).toString();
      router.replace(sp ? `${pathname}?${sp}` : pathname, { scroll: false });
    }, 250);
    return () => clearTimeout(t);
  }, [buscaLocal, filtros, ordem, pathname, router]);

  const contagens = useMemo(() => {
    const l = data ?? [];
    return { atrasadas: l.filter((o) => o.atrasada).length, naoLidas: l.filter((o) => o.naoLidoAdmin).length, reabertura: l.filter((o) => !!pedidoPendente(o)).length };
  }, [data]);

  const itens = useMemo(() => ordenarFila(filtrarFila(data ?? [], filtros), ordem), [data, filtros, ordem]);
  const temFiltro = !!(filtros.status || filtros.categoria || filtros.bairro || filtros.busca || filtros.soAtrasadas || filtros.soNaoLidas || filtros.comReabertura);

  const alternar = (k: ChaveChip) => aplicar({ [k]: !filtros[k] });

  return (
    <div>
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-fg-subtle" />
          <input
            type="search"
            id="fila-busca"
            aria-label="Buscar por protocolo, título, endereço ou cidadão"
            placeholder="Buscar por protocolo, título ou cidadão"
            value={buscaLocal}
            onChange={(e) => setBuscaLocal(e.target.value)}
            className={cn(fieldClasses, 'h-12 pl-12')}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select aria-label="Status" value={filtros.status} onChange={(e) => aplicar({ status: e.target.value })}>
            <option value="">Todos os status</option>
            {STATUS_LISTA.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Select aria-label="Categoria" value={filtros.categoria} onChange={(e) => aplicar({ categoria: e.target.value })}>
            <option value="">Todas as categorias</option>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select aria-label="Bairro" value={filtros.bairro} onChange={(e) => aplicar({ bairro: e.target.value })}>
            <option value="">Todos os bairros</option>
            {BAIRROS.map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>
          <Select aria-label="Ordenar por" value={ordem} onChange={(e) => aplicar({}, e.target.value as OrdemFila)}>
            {ORDENS.map((o) => <option key={o} value={o}>{ORDEM_ROTULO[o]}</option>)}
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Chip ativo={filtros.soAtrasadas} onClick={() => alternar('soAtrasadas')} icone={TriangleAlert} contagem={contagens.atrasadas}>Atrasadas</Chip>
          <Chip ativo={filtros.soNaoLidas} onClick={() => alternar('soNaoLidas')} icone={BellRing} contagem={contagens.naoLidas}>Não lidas</Chip>
          <Chip ativo={filtros.comReabertura} onClick={() => alternar('comReabertura')} icone={ClipboardList} contagem={contagens.reabertura}>Reabertura pedida</Chip>
          {temFiltro && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setBuscaLocal(''); ultimaBuscaEnviada.current = ''; router.replace(pathname, { scroll: false }); }}
            >
              <X aria-hidden /> Limpar filtros
            </Button>
          )}
        </div>
      </div>

      <p className="mt-8 text-sm text-fg-muted" aria-live="polite" data-testid="fila-contagem">
        {data ? `${itens.length} ${itens.length === 1 ? 'ocorrência' : 'ocorrências'}${temFiltro ? ` de ${data.length}` : ''}` : 'Carregando...'}
      </p>

      <div className="mt-4">
        {error ? (
          <Card>
            <EmptyState icon={ClipboardList} title="Não foi possível carregar" description={error.message} action={<Button variant="secondary" onClick={() => mutate()}>Tentar de novo</Button>} />
          </Card>
        ) : !data ? (
          <div className="flex flex-col gap-4" aria-hidden>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[72px] rounded-xl" />)}
          </div>
        ) : data.length === 0 ? (
          <Card>
            <EmptyState icon={ClipboardList} title="Nenhuma ocorrência ainda" description="Quando os cidadãos registrarem ocorrências, elas aparecem aqui." />
          </Card>
        ) : itens.length === 0 ? (
          <Card>
            <EmptyState icon={SearchX} title="Nada encontrado" description="Nenhuma ocorrência combina com esses filtros." action={<Button variant="secondary" onClick={() => { setBuscaLocal(''); ultimaBuscaEnviada.current = ''; router.replace(pathname, { scroll: false }); }}>Limpar filtros</Button>} />
          </Card>
        ) : desktop ? (
          <Tabela itens={itens} />
        ) : (
          <div className="flex flex-col gap-4">
            {itens.map((o) => <OcorrenciaAdminCard key={o.id} o={o} />)}
          </div>
        )}
      </div>
    </div>
  );
}
