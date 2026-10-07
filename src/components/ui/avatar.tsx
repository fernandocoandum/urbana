import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';

const sizes = {
  xs: 'size-6 text-caption',
  sm: 'size-8 text-sm',
  md: 'size-10 text-sm',
  lg: 'size-14 text-xl',
  xl: 'size-28 text-4xl',
} as const;

/** Foto (img) ou iniciais. O nome é texto puro: o React escapa. */
export function Avatar({ nome, foto, size = 'md', className }: { nome?: string | null; foto?: string | null; size?: keyof typeof sizes; className?: string }) {
  return (
    <span
      className={cn('relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary-soft font-semibold text-primary', sizes[size], className)}
    >
      {foto ? <img src={foto} alt={nome ? `Foto de ${nome}` : ''} className="size-full object-cover" /> : <span aria-hidden={!!nome}>{initials(nome)}</span>}
    </span>
  );
}
