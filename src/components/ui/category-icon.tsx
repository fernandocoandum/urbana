import { categoriaInfo } from '@/features/ocorrencias/categorias';
import { cn } from '@/lib/utils';

const sizes = { sm: 'size-8 [&_svg]:size-4', md: 'size-10 [&_svg]:size-5', lg: 'size-12 [&_svg]:size-6' } as const;

/** Ícone lucide da categoria em círculo com a cor da categoria. */
export function CategoryIcon({ categoria, size = 'md', className }: { categoria: string; size?: keyof typeof sizes; className?: string }) {
  const { icon: Icon, cssVar } = categoriaInfo(categoria);
  return (
    <span
      aria-hidden
      className={cn('inline-grid shrink-0 place-items-center rounded-full', sizes[size], className)}
      style={{ color: `var(${cssVar})`, backgroundColor: `color-mix(in srgb, var(${cssVar}) 14%, transparent)` }}
    >
      <Icon />
    </span>
  );
}
