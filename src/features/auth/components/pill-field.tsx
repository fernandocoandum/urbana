import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Campo em pílula da tela de entrada: passe por className ao Input, Select, PasswordInput ou PasswordStrength. */
export const pillClasses = 'rounded-full border-transparent bg-surface-2 pl-12 hover:border-transparent focus:bg-surface';

/** Ícone à esquerda + rótulo só para leitor de tela (o placeholder faz o papel visual). */
export function PillField({ icon: Icon, label, htmlFor, children }: { icon: LucideIcon; label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="relative">
      <label htmlFor={htmlFor} className="sr-only">{label}</label>
      {children}
      <Icon aria-hidden className="pointer-events-none absolute left-4 top-6 size-5 -translate-y-1/2 text-fg-muted" />
    </div>
  );
}
