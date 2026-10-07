'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState, type InputHTMLAttributes, type Ref } from 'react';
import { cn } from '@/lib/utils';
import { fieldClasses } from './input';

/** Campo de senha com botão de olho (login e redefinição). O medidor de força fica em PasswordStrength. */
export function PasswordInput({ className, ref, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { ref?: Ref<HTMLInputElement> }) {
  const [visivel, setVisivel] = useState(false);
  return (
    <div className="relative">
      <input ref={ref} {...props} type={visivel ? 'text' : 'password'} className={cn(fieldClasses, 'h-12 pr-14', className)} />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visivel}
        className="absolute right-1.5 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-fg-muted outline-none transition-colors hover:bg-surface-2 hover:text-fg focus-visible:ring-4 focus-visible:ring-primary/25"
      >
        {visivel ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  );
}
