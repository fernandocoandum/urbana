import type { InputHTMLAttributes, ReactNode, Ref, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Estilo único dos campos (o do password-strength, aplicado ao app inteiro): 48px, borda de 2px,
// foco com borda primary + anel de 4px.
export const fieldClasses =
  'w-full rounded-md border-2 border-border bg-surface px-4 text-base text-fg outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-fg-subtle hover:border-border-strong focus:border-primary focus:ring-4 focus:ring-primary/15 aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/15 disabled:cursor-not-allowed disabled:opacity-60';

export function Input({ className, ref, ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} className={cn(fieldClasses, 'h-12', className)} {...props} />;
}

export function Textarea({ className, ref, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea ref={ref} className={cn(fieldClasses, 'min-h-28 resize-y py-3', className)} {...props} />;
}

/** Select nativo estilizado (acessível e ótimo no mobile). */
export function Select({ className, children, ref, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(fieldClasses, 'h-12 appearance-none pr-11', className)} {...props}>
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-fg-muted" />
    </div>
  );
}

/** Rótulo + campo + dica/erro. O erro usa role="alert". */
export function Field({ label, htmlFor, hint, error, optional, className, children }: { label: string; htmlFor: string; hint?: string; error?: string | null; optional?: boolean; className?: string; children: ReactNode }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-fg">
        {label}
        {optional && <span className="ml-1 font-normal text-fg-muted">(opcional)</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-fg-muted">{hint}</p>
      ) : null}
    </div>
  );
}
