import { MapPin } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/** Marca: ícone MapPin em círculo primary-soft + "Urbana" (18/600). */
export function Brand({ href = '/inicio', showText = true, className }: { href?: string; showText?: boolean; className?: string }) {
  return (
    <Link href={href} aria-label="Urbana — início" className={cn('flex items-center gap-2.5 rounded-full outline-none focus-visible:ring-4 focus-visible:ring-primary/25', className)}>
      <span className="grid size-9 place-items-center rounded-full bg-primary-soft text-primary">
        <MapPin className="size-5" aria-hidden />
      </span>
      {showText && <span className="text-lg font-semibold tracking-[-.01em]">Urbana</span>}
    </Link>
  );
}
