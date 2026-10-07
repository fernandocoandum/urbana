import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const sizes = {
  citizen: 'max-w-[1120px]',
  admin: 'max-w-[1280px]',
  /** colunas de leitura e formulários */
  read: 'max-w-[680px]',
  /** Início, perfil */
  column: 'max-w-[880px]',
} as const;

/** Container de página: padding 20 (mobile) / 32 (tablet) / 40 (desktop) e larguras máximas do plano. */
export function Container({ size = 'citizen', className, children }: { size?: keyof typeof sizes; className?: string; children: ReactNode }) {
  return <div className={cn('mx-auto w-full px-5 py-8 sm:px-8 sm:py-10 lg:px-10', sizes[size], className)}>{children}</div>;
}

/** Título de página (30/38, 600) com descrição e uma ação opcional à direita. */
export function PageHeader({ title, description, action, className }: { title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <header className={cn('mb-8 flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="text-3xl font-semibold tracking-[-.015em]">{title}</h1>
        {description && <p className="mt-2 text-base text-fg-muted">{description}</p>}
      </div>
      {action}
    </header>
  );
}

/** Espaçamento entre seções: 40. */
export function Section({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('mt-10 first:mt-0', className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-4">
          {title && <h2 className="text-2xl font-semibold tracking-[-.01em]">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
