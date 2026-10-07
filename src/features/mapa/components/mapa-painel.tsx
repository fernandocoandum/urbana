'use client';

import { Flame, MapPin } from 'lucide-react';
import { AnimatedTabs, type TabItem } from '@/components/ui/animated-tabs';
import { Select } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { CATEGORIAS, STATUS_LISTA, categoriaInfo, statusCssVar } from '@/features/ocorrencias/categorias';
import { cn } from '@/lib/utils';
import type { BairroRank, FiltrosMapa } from '../mapa-utils';
import type { ModoMapa } from './mapa-cidade';

const MODOS: TabItem[] = [
  { value: 'pontos', label: 'Pontos', icon: MapPin },
  { value: 'calor', label: 'Calor', icon: Flame },
];

interface Props {
  filtros: FiltrosMapa;
  onFiltros: (f: FiltrosMapa) => void;
  modo: ModoMapa;
  onModo: (m: ModoMapa) => void;
  /** O cidadão tem "Só as minhas"; o admin vê tudo. */
  admin: boolean;
  ranking: BairroRank[];
  onBairro: (b: BairroRank) => void;
}

function Rotulo({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-fg-muted">
      {children}
    </label>
  );
}

/** Conteúdo do painel de filtros (card flutuante no desktop, Sheet no mobile). */
export function PainelConteudo({ filtros, onFiltros, modo, onModo, admin, ranking, onBairro }: Props) {
  const maior = ranking[0]?.total || 1;
  const alternar = (cat: string) => {
    const tem = filtros.categorias.includes(cat);
    onFiltros({ ...filtros, categorias: tem ? filtros.categorias.filter((c) => c !== cat) : [...filtros.categorias, cat] });
  };

  return (
    <div className="flex flex-col gap-4">
      <AnimatedTabs tabs={MODOS} value={modo} onValueChange={(v) => onModo(v as ModoMapa)} fullWidth aria-label="Modo do mapa" />

      <div className="flex flex-col gap-2">
        <Rotulo>Categoria</Rotulo>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por categoria">
          {CATEGORIAS.map((cat) => {
            const on = filtros.categorias.includes(cat);
            const { cssVar, curta } = categoriaInfo(cat);
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={on}
                onClick={() => alternar(cat)}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm md:h-8 md:px-2.5 font-medium outline-none transition-colors focus-visible:ring-4 focus-visible:ring-primary/25',
                  on ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg',
                )}
              >
                <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: `var(${cssVar})` }} />
                {curta}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Rotulo htmlFor="mapa-status">Status</Rotulo>
        <Select id="mapa-status" className="h-11 md:h-10" value={filtros.status} onChange={(e) => onFiltros({ ...filtros, status: e.target.value })}>
          <option value="todos">Todos os status</option>
          {STATUS_LISTA.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </div>

      {admin ? (
        <div className="flex items-center justify-between gap-4">
          <Rotulo htmlFor="mapa-atrasadas">Só atrasadas</Rotulo>
          <Switch id="mapa-atrasadas" checked={filtros.soAtrasadas} onCheckedChange={(v) => onFiltros({ ...filtros, soAtrasadas: v })} />
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <Rotulo htmlFor="mapa-minhas">Só as minhas</Rotulo>
          <Switch id="mapa-minhas" checked={filtros.soMinhas} onCheckedChange={(v) => onFiltros({ ...filtros, soMinhas: v })} />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <Rotulo>Por bairro</Rotulo>
        {ranking.length === 0 ? (
          <p className="py-2 text-sm text-fg-muted">Nenhuma ocorrência com esses filtros.</p>
        ) : (
          <ul className="-mx-2">
            {ranking.map((b) => (
              <li key={b.bairro}>
                <button
                  type="button"
                  onClick={() => onBairro(b)}
                  className="group flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left md:min-h-9 outline-none transition-colors hover:bg-surface-2 focus-visible:ring-4 focus-visible:ring-primary/25"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{b.bairro}</span>
                    <span aria-hidden className="mt-0.5 block h-1 overflow-hidden rounded-full bg-surface-2 group-hover:bg-border">
                      <span className="block h-full rounded-full bg-primary/70" style={{ width: `${Math.max(8, Math.round((b.total / maior) * 100))}%` }} />
                    </span>
                  </span>
                  <span className="tabular w-6 text-right text-sm text-fg-muted">{b.total}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-border pt-3">
        <p className="sr-only">Legenda das cores de status</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-caption font-medium text-fg-muted">
          {STATUS_LISTA.map((s) => (
            <li key={s} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: `var(${statusCssVar(s)})` }} />
              {s}
            </li>
          ))}
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full border border-dashed border-fg-subtle" />
            Localização aproximada
          </li>
        </ul>
      </div>
    </div>
  );
}
