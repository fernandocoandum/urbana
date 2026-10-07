import { statusCssVar } from '@/features/ocorrencias/categorias';
import { cn } from '@/lib/utils';

/** Badge de status: fundo soft (12% da cor) + texto da cor + ponto de 8px. */
export function StatusBadge({ status, className, ...props }: { status: string; className?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  const v = statusCssVar(status);
  return (
    <span
      data-testid="status-badge"
      className={cn('inline-flex h-7 items-center gap-2 whitespace-nowrap rounded-full px-3 text-sm font-medium', className)}
      style={{ color: `var(${v})`, backgroundColor: `color-mix(in srgb, var(${v}) 12%, transparent)` }}
      {...props}
    >
      <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: `var(${v})` }} />
      {status}
    </span>
  );
}
