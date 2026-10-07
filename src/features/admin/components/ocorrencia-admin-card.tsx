import { TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { CategoryIcon } from '@/components/ui/category-icon';
import { StatusBadge } from '@/components/ui/status-badge';
import { pedidoPendente } from '@/features/ocorrencias/proxima-acao';
import type { OcorrenciaDerivada } from '@/lib/db/types';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Barra de criticidade: preenche até 60 pontos; vermelha quando atrasada. */
export function BarraCriticidade({ o, className }: { o: Pick<OcorrenciaDerivada, 'criticidade' | 'atrasada'>; className?: string }) {
  const pct = Math.max(4, Math.min(100, Math.round((o.criticidade / 60) * 100)));
  return (
    <span className={cn('flex items-center gap-2', className)} title={`Criticidade ${o.criticidade}`}>
      <span aria-hidden className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
        <span className={cn('block h-full rounded-full', o.atrasada ? 'bg-danger' : 'bg-primary')} style={{ width: `${pct}%` }} />
      </span>
      <span className="tabular text-sm text-fg-muted">{o.criticidade}</span>
    </span>
  );
}

export function textoDiasAberto(dias: number): string {
  return dias === 0 ? 'Hoje' : dias === 1 ? '1 dia' : `${dias} dias`;
}

/** Card de ocorrência para a fila no celular e para a lista "precisam de atenção". */
export function OcorrenciaAdminCard({ o }: { o: OcorrenciaDerivada }) {
  const reabertura = !!pedidoPendente(o);
  return (
    <Link
      href={`/admin/ocorrencias/${o.id}`}
      data-testid="fila-item"
      className="group flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-xs outline-none transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-px hover:border-border-strong hover:shadow-md focus-visible:ring-4 focus-visible:ring-primary/25"
    >
      <span className="flex items-start gap-4">
        <span className="relative shrink-0">
          <CategoryIcon categoria={o.categoria} />
          {o.naoLidoAdmin && (
            <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-primary ring-2 ring-surface">
              <span className="sr-only">Não lida</span>
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold">{o.titulo}</span>
          <span className="mt-0.5 block truncate text-sm text-fg-muted">
            {o.nomeUsuario || 'Cidadão'} · {o.bairro}
          </span>
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <StatusBadge status={o.status} />
        {reabertura && (
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-warning-soft px-3 text-sm font-medium text-warning">
            <TriangleAlert className="size-4" aria-hidden /> Reabertura pedida
          </span>
        )}
        {o.atrasada && <span className="inline-flex h-7 items-center rounded-full bg-danger-soft px-3 text-sm font-medium text-danger">Atrasada</span>}
      </span>
      <span className="flex items-center justify-between gap-3 text-sm text-fg-muted">
        <span className="font-protocol text-fg-subtle">{o.protocolo}</span>
        <span className="tabular">
          {textoDiasAberto(o.diasAberto)}
          {o.prazo && o.status !== 'Resolvida' ? <span className={cn('ml-2', o.atrasada && 'font-medium text-danger')}>· prazo {fmtDate(o.prazo)}</span> : null}
        </span>
      </span>
      {o.status !== 'Resolvida' && <BarraCriticidade o={o} />}
    </Link>
  );
}
