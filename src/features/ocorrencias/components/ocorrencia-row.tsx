import Link from 'next/link';
import { CategoryIcon } from '@/components/ui/category-icon';
import { StatusBadge } from '@/components/ui/status-badge';
import type { OcorrenciaDerivada } from '@/lib/db/types';
import { fmtDate } from '@/lib/format';

/** Linha de ocorrência: ícone da categoria, título, endereço e, à direita, status + data. */
export function OcorrenciaRow({ o }: { o: OcorrenciaDerivada }) {
  return (
    <Link
      href={`/ocorrencias/${o.id}`}
      data-testid="ocorrencia-card"
      className="group grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 rounded-xl border border-border bg-surface p-4 shadow-xs outline-none transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-px hover:border-border-strong hover:shadow-md focus-visible:ring-4 focus-visible:ring-primary/25 sm:grid-cols-[auto_1fr_auto] sm:p-5"
    >
      <span className="relative">
        <CategoryIcon categoria={o.categoria} />
        {o.naoLidoCidadao && (
          <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-primary ring-2 ring-surface">
            <span className="sr-only">Atualização nova</span>
          </span>
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-base font-semibold">{o.titulo}</span>
        <span className="mt-0.5 block truncate text-sm text-fg-muted">{o.endereco || o.bairro}</span>
      </span>
      <span className="col-start-2 flex items-center justify-between gap-3 sm:col-start-3 sm:row-start-1 sm:flex-col sm:items-end sm:gap-1.5">
        <StatusBadge status={o.status} />
        <span className="tabular text-sm text-fg-muted">{fmtDate(o.criadoEm)}</span>
      </span>
    </Link>
  );
}
