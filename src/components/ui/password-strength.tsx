'use client';

// Recriado a partir do "password-strength" de @ddoemonn (21st.dev, MIT): campo com olho,
// 4 barras segmentadas animadas por nível, checklist ao vivo e avisos de padrões comuns.
import { AnimatePresence, motion } from 'motion/react';
import { Check, Eye, EyeOff, TriangleAlert } from 'lucide-react';
import { useMemo, useState, type InputHTMLAttributes } from 'react';
import { avaliarSenha, type SenhaContexto } from '@/features/auth/password-strength';
import { ease, spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { fieldClasses } from './input';

const cores = ['var(--danger)', 'var(--warning)', 'var(--primary)', 'var(--success)'];

const itens = [
  { chave: 'tamanho', texto: '8+ caracteres' },
  { chave: 'maiusculaMinuscula', texto: 'Maiúscula e minúscula' },
  { chave: 'numero', texto: 'Um número' },
  { chave: 'simbolo', texto: 'Um símbolo (!@#…)' },
] as const;

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string;
  onChange: (valor: string) => void;
  contexto?: SenhaContexto;
  /** Esconde o checklist (mantém barras e rótulo). */
  semChecklist?: boolean;
}

export function PasswordStrength({ value, onChange, contexto, semChecklist, className, id, ...rest }: Props) {
  const [visivel, setVisivel] = useState(false);
  const av = useMemo(() => avaliarSenha(value, contexto), [value, contexto]);
  const cor = av.nivel ? cores[av.nivel - 1] : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <input
          {...rest}
          id={id}
          type={visivel ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(fieldClasses, 'h-12 pr-14', className)}
          autoComplete={rest.autoComplete ?? 'new-password'}
        />
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

      <div className="flex items-center gap-3" aria-live="polite">
        <div className="grid flex-1 grid-cols-4 gap-1.5" role="presentation">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-1.5 overflow-hidden rounded-full bg-border">
              <motion.div
                className="h-full origin-left rounded-full"
                style={{ backgroundColor: cor }}
                initial={false}
                animate={{ scaleX: i < av.nivel ? 1 : 0 }}
                transition={{ duration: 0.3, ease: ease.easeOut, delay: i < av.nivel ? i * 0.04 : 0 }}
              />
            </div>
          ))}
        </div>
        <span className="min-w-[5.5rem] text-right text-sm font-medium" style={{ color: cor ?? 'var(--fg-muted)' }}>
          {av.rotulo ?? 'Sem senha'}
          <span className="sr-only">: força da senha</span>
        </span>
      </div>

      {!semChecklist && (
        <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Requisitos da senha">
          {itens.map(({ chave, texto }) => {
            const ok = av.requisitos[chave];
            return (
              <li key={chave} className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-sm transition-colors', ok ? 'text-fg' : 'text-fg-muted')}>
                <span className={cn('grid size-4 shrink-0 place-items-center rounded-full border-2 transition-colors', ok ? 'border-success bg-success text-primary-fg' : 'border-border-strong')}>
                  <AnimatePresence initial={false}>
                    {ok && (
                      <motion.span key="check" className="grid place-items-center" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={spring.bouncy}>
                        <Check className="size-2.5" strokeWidth={3} aria-hidden />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
                {texto}
                <span className="sr-only">{ok ? ' (atendido)' : ' (pendente)'}</span>
              </li>
            );
          })}
        </ul>
      )}

      {av.avisos.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-sm text-fg-muted" aria-live="polite">
          {av.avisos.map((a) => (
            <li key={a} className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              {a}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
