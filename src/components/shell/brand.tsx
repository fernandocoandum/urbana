import Link from 'next/link';
import { cn } from '@/lib/utils';

/** Símbolo "Sinal": um ponto emitindo sinal (a ocorrência sendo relatada). Usa currentColor. */
export function UrbanaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth={6} strokeLinecap="round">
      <circle cx="32" cy="44" r="7" fill="currentColor" stroke="none" />
      <path d="M18.8 37a15 15 0 0 1 26.4 0" />
      <path d="M9.5 31a26 26 0 0 1 45 0" />
    </svg>
  );
}

/** Logotipo em linha: bloco do símbolo + "urbana" em Bricolage Grotesque. `tone="inverse"` para fundos azuis. */
export function UrbanaLogo({ showText = true, tone = 'default', className }: { showText?: boolean; tone?: 'default' | 'inverse'; className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-[10px]', tone === 'inverse' ? 'bg-white text-primary' : 'bg-primary text-primary-fg')}>
        <UrbanaMark className="size-6" />
      </span>
      {showText && <span className="font-brand text-[1.375rem] font-bold leading-none tracking-[-.035em]">urbana</span>}
    </span>
  );
}

/** Marca com link para o início. */
export function Brand({ href = '/inicio', showText = true, className }: { href?: string; showText?: boolean; className?: string }) {
  return (
    <Link href={href} aria-label="Urbana — início" className={cn('rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-primary/25', className)}>
      <UrbanaLogo showText={showText} />
    </Link>
  );
}
