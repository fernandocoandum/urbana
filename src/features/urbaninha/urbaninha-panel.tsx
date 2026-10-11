'use client';

import { Camera, Clock3, KeyRound, MapPinPlus, SendHorizontal, X, type LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { responderUrbaninha, URBANINHA_SUGESTOES } from './rules';
import { UrbaninhaMascote } from './urbaninha-mascote';

interface Msg { id: number; de: 'bot' | 'user'; texto: string }

// Ícone de cada sugestão, na mesma ordem de URBANINHA_SUGESTOES.
const ICONES_SUGESTAO: LucideIcon[] = [MapPinPlus, KeyRound, Clock3, Camera];

/** Painel de 360×540 da Urbaninha. Carregado sob demanda no primeiro clique do botão flutuante. */
export default function UrbaninhaPanel({ aberto, onClose }: { aberto: boolean; onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [digitando, setDigitando] = useState(false);
  const [texto, setTexto] = useState('');
  const proximoId = useRef(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lista = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);

  const falar = useCallback((de: Msg['de'], t: string) => {
    setMsgs((m) => [...m, { id: proximoId.current++, de, texto: t }]);
  }, []);
  /** Mostra "digitando..." por 500–1000ms antes da resposta (como no legado). */
  const responderDepois = useCallback((resposta: string) => {
    setDigitando(true);
    const t = setTimeout(() => { setDigitando(false); falar('bot', resposta); }, 500 + Math.random() * 500);
    timers.current.push(t);
  }, [falar]);

  useEffect(() => {
    const pendentes = timers.current;
    return () => pendentes.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const foco = setTimeout(() => entrada.current?.focus(), 320);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => { clearTimeout(foco); window.removeEventListener('keydown', esc); };
  }, [aberto, onClose]);

  useEffect(() => {
    lista.current?.scrollTo({ top: lista.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, digitando]);

  function perguntar(pergunta: string) {
    falar('user', pergunta);
    responderDepois(responderUrbaninha(pergunta));
  }
  function enviar(e: FormEvent) {
    e.preventDefault();
    const t = texto.trim();
    if (!t) return;
    setTexto('');
    perguntar(t);
  }

  const conversou = msgs.length > 0;

  return (
    <AnimatePresence>
      {aberto && (
        <motion.div
          role="dialog"
          aria-label="Chat de suporte Urbaninha"
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98, transition: { duration: 0.16 } }}
          transition={spring.smooth}
          style={{ transformOrigin: 'bottom right' }}
          className="fixed inset-x-0 bottom-0 z-50 flex h-[min(540px,85dvh)] flex-col overflow-hidden rounded-t-3xl border border-border bg-surface pb-safe shadow-lg sm:inset-x-auto sm:bottom-24 sm:right-6 sm:h-[540px] sm:w-[370px] sm:rounded-3xl"
        >
          <header className="relative flex items-center gap-3 overflow-hidden bg-primary px-4 py-3.5 text-primary-fg">
            {/* brilho decorativo */}
            <span aria-hidden className="pointer-events-none absolute -right-10 -top-16 size-40 rounded-full bg-white/15 blur-2xl app:hidden" />
            <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-white/90 shadow-sm">
              <UrbaninhaMascote humor={digitando ? 'pensando' : 'feliz'} animado={false} className="size-10" />
              <span aria-hidden className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-primary bg-[#4ade80]" />
            </span>
            <div className="relative min-w-0 flex-1">
              <p className="font-brand text-lg font-bold leading-6 tracking-[-.02em]">Urbaninha</p>
              <p className="truncate text-sm opacity-85">{digitando ? 'digitando…' : 'Assistente do Urbana · online'}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar chat" className="relative grid size-11 place-items-center rounded-full outline-none transition-colors hover:bg-white/15 focus-visible:ring-4 focus-visible:ring-white/40">
              <X className="size-5" aria-hidden />
            </button>
          </header>

          <div ref={lista} className="flex flex-1 flex-col gap-2 overflow-y-auto bg-bg px-4 py-4" role="log" aria-live="polite">
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={spring.gentle}
              className="mb-2 flex flex-col items-center text-center"
            >
              <UrbaninhaMascote humor="acenando" className="mt-1 h-24 w-[86px]" />
              <h2 className="mt-2 font-brand text-xl font-bold tracking-[-.02em]">Oi! Eu sou a Urbaninha 👋</h2>
              <p className="mt-1 max-w-[260px] text-sm text-fg-muted">
                Tiro suas dúvidas sobre o Urbana. Escolhe um assunto ou escreve sua pergunta.
              </p>
              <div className="mt-4 grid w-full grid-cols-2 gap-2">
                {URBANINHA_SUGESTOES.map((s, i) => {
                  const Icone = ICONES_SUGESTAO[i] ?? MapPinPlus;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => perguntar(s)}
                      className="flex items-start gap-2 rounded-2xl border border-border bg-surface p-3 text-left text-sm font-medium leading-snug outline-none transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-primary hover:bg-primary-soft focus-visible:ring-4 focus-visible:ring-primary/25 active:scale-[.98]"
                    >
                      <Icone className="mt-px size-4 shrink-0 text-primary" aria-hidden />
                      {s}
                    </button>
                  );
                })}
              </div>
            </motion.section>

            {msgs.map((m, i) => {
              const ultimaDoBot = m.de === 'bot' && msgs[i + 1]?.de !== 'bot' && !(digitando && i === msgs.length - 1);
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={spring.smooth}
                  className={cn('flex items-end gap-2', m.de === 'user' ? 'justify-end' : 'justify-start')}
                >
                  {m.de === 'bot' && (
                    <span className="w-7 shrink-0">
                      {ultimaDoBot && <UrbaninhaMascote animado={false} className="h-8 w-7" />}
                    </span>
                  )}
                  <p
                    className={cn(
                      'max-w-[80%] whitespace-pre-wrap break-words rounded-[20px] px-4 py-2.5 text-[0.9375rem] leading-relaxed',
                      m.de === 'user'
                        ? 'rounded-br-md bg-primary text-primary-fg'
                        : 'rounded-bl-md border border-border bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)]',
                    )}
                  >
                    {m.texto}
                  </p>
                </motion.div>
              );
            })}
            {digitando && (
              <div className="flex items-end gap-2" aria-label="Urbaninha está digitando">
                <UrbaninhaMascote humor="pensando" className="h-8 w-7 shrink-0" />
                <div className="flex gap-1.5 rounded-[20px] rounded-bl-md border border-border bg-surface px-4 py-3.5">
                  {[0, 1, 2].map((i) => (
                    <motion.span key={i} className="size-2 rounded-full bg-fg-subtle" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12 }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {conversou && (
            <div className="flex gap-2 overflow-x-auto border-t border-border px-4 pt-3 [scrollbar-width:none]">
              {URBANINHA_SUGESTOES.map((s, i) => {
                const Icone = ICONES_SUGESTAO[i] ?? MapPinPlus;
                return (
                  <button key={s} type="button" onClick={() => perguntar(s)} className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-fg-muted outline-none transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary focus-visible:ring-4 focus-visible:ring-primary/25">
                    <Icone className="size-3.5" aria-hidden />
                    {s}
                  </button>
                );
              })}
            </div>
          )}

          <form onSubmit={enviar} className={cn('flex items-center gap-2 p-3', !conversou && 'border-t border-border')}>
            <input
              ref={entrada}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={240}
              autoComplete="off"
              placeholder="Pergunte à Urbaninha…"
              aria-label="Digite sua dúvida"
              className="h-11 min-w-0 flex-1 rounded-full border border-border bg-surface-2 px-4 text-base outline-none transition-[border-color,box-shadow,background-color] placeholder:text-fg-subtle focus:border-primary focus:bg-surface focus:ring-4 focus:ring-primary/15"
            />
            <button
              type="submit"
              aria-label="Enviar"
              disabled={!texto.trim()}
              className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-fg outline-none transition-[background-color,transform,opacity] hover:bg-primary-hover focus-visible:ring-4 focus-visible:ring-primary/30 active:scale-95 disabled:opacity-40"
            >
              <SendHorizontal className="size-5" aria-hidden />
            </button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
