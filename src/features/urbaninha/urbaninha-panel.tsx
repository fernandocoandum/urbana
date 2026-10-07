'use client';

import { Bot, SendHorizontal, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { responderUrbaninha, URBANINHA_BOAS_VINDAS, URBANINHA_SUGESTOES } from './rules';

interface Msg { id: number; de: 'bot' | 'user'; texto: string }

/** Painel de 360×520 da Urbaninha. Carregado sob demanda no primeiro clique do botão flutuante. */
export default function UrbaninhaPanel({ aberto, onClose }: { aberto: boolean; onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [digitando, setDigitando] = useState(false);
  const [texto, setTexto] = useState('');
  const proximoId = useRef(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lista = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const iniciou = useRef(false);

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
    if (!iniciou.current) {
      iniciou.current = true;
      responderDepois(URBANINHA_BOAS_VINDAS);
    }
    const foco = setTimeout(() => entrada.current?.focus(), 320);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => { clearTimeout(foco); window.removeEventListener('keydown', esc); };
  }, [aberto, onClose, responderDepois]);

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
          className="fixed inset-x-0 bottom-0 z-50 flex h-[min(520px,82dvh)] flex-col overflow-hidden rounded-t-2xl border border-border bg-surface pb-safe shadow-lg sm:inset-x-auto sm:bottom-24 sm:right-6 sm:h-[520px] sm:w-[360px] sm:rounded-2xl"
        >
          <header className="flex items-center gap-3 border-b border-border px-4 py-3">
            <span className="grid size-10 place-items-center rounded-full bg-primary-soft text-primary">
              <Bot className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold leading-5">Urbaninha</p>
              <p className="flex items-center gap-1.5 text-sm text-fg-muted">
                <span aria-hidden className="size-2 rounded-full bg-success" /> assistente virtual
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar chat" className="grid size-11 place-items-center rounded-full text-fg-muted outline-none transition-colors hover:bg-surface-2 hover:text-fg focus-visible:ring-4 focus-visible:ring-primary/25">
              <X className="size-5" aria-hidden />
            </button>
          </header>

          <div ref={lista} className="flex flex-1 flex-col gap-3 overflow-y-auto bg-bg px-4 py-4" role="log" aria-live="polite">
            {msgs.map((m) => (
              <motion.p
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={spring.smooth}
                className={cn(
                  'max-w-[85%] whitespace-pre-wrap break-words rounded-[18px] px-4 py-2.5 text-base',
                  m.de === 'user' ? 'self-end rounded-br-md bg-primary text-primary-fg' : 'self-start rounded-bl-md bg-surface-2',
                )}
              >
                {m.texto}
              </motion.p>
            ))}
            {digitando && (
              <div className="flex gap-1.5 self-start rounded-[18px] rounded-bl-md bg-surface-2 px-4 py-3.5" aria-label="Urbaninha está digitando">
                {[0, 1, 2].map((i) => (
                  <motion.span key={i} className="size-2 rounded-full bg-fg-subtle" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: 2, delay: i * 0.12 }} />
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border px-4 pt-3">
            {URBANINHA_SUGESTOES.map((s) => (
              <button key={s} type="button" onClick={() => perguntar(s)} className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-fg-muted outline-none transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary focus-visible:ring-4 focus-visible:ring-primary/25">
                {s}
              </button>
            ))}
          </div>

          <form onSubmit={enviar} className="flex items-center gap-2 p-4">
            <input
              ref={entrada}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={240}
              autoComplete="off"
              placeholder="Digite sua dúvida..."
              aria-label="Digite sua dúvida"
              className="h-11 min-w-0 flex-1 rounded-full border-2 border-border bg-surface px-4 text-base outline-none transition-[border-color,box-shadow] placeholder:text-fg-subtle focus:border-primary focus:ring-4 focus:ring-primary/15"
            />
            <button type="submit" aria-label="Enviar" className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-fg outline-none transition-[background-color,transform] hover:bg-primary-hover focus-visible:ring-4 focus-visible:ring-primary/30 active:scale-95">
              <SendHorizontal className="size-5" aria-hidden />
            </button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
