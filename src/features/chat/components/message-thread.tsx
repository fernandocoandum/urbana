'use client';

// Versão básica da conversa por ocorrência (Etapa D). A Etapa E a refina (agrupamento, otimista,
// variante da "praça"); a API de props já é a definitiva.
import { motion } from 'motion/react';
import { SendHorizontal } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { fieldClasses } from '@/components/ui/input';
import { fmtDateTime } from '@/lib/format';
import { spring } from '@/lib/motion';
import { Sound } from '@/lib/sound';
import { cn } from '@/lib/utils';
import type { Mensagem } from '@/lib/db/types';

interface Props {
  mensagens: Mensagem[];
  /** De que lado fica a bolha própria (a mesma conversa é vista pelos dois lados). */
  ladoProprio: 'cidadao' | 'prefeitura';
  /** Deve rejeitar com Error em caso de falha: o texto digitado é mantido. */
  onSend: (texto: string) => Promise<void>;
  variant?: 'ocorrencia';
  /** id do textarea e data-testid do botão de enviar (seletores dos testes). */
  inputId?: string;
  sendTestId?: string;
  className?: string;
}

export function MessageThread({ mensagens, ladoProprio, onSend, inputId, sendTestId, className }: Props) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const rolagem = useRef<HTMLDivElement>(null);
  const total = mensagens.length;

  useEffect(() => {
    const el = rolagem.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [total]);

  async function enviar() {
    const t = texto.trim();
    if (!t) { toast.error('Escreva uma mensagem.'); return; }
    setEnviando(true);
    try {
      await onSend(t);
      setTexto('');
      Sound.play('send');
    } catch (err) {
      toast.error('Erro: ' + (err instanceof Error ? err.message : 'não foi possível enviar'));
    } finally {
      setEnviando(false);
    }
  }

  function aoTeclar(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!enviando) void enviar();
    }
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div ref={rolagem} className="flex h-[420px] flex-col gap-3 overflow-y-auto rounded-xl bg-bg p-4" role="log" aria-label="Mensagens" tabIndex={0}>
        {mensagens.length === 0 ? (
          <p className="m-auto max-w-56 text-center text-sm text-fg-muted">Nenhuma mensagem ainda. Escreva abaixo para falar com a prefeitura.</p>
        ) : (
          mensagens.map((m) => {
            const propria = m.de === ladoProprio;
            const quem = propria ? 'Você' : m.de === 'prefeitura' ? 'Prefeitura' : 'Cidadão';
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={spring.smooth}
                className={cn('flex max-w-[85%] flex-col gap-1', propria ? 'items-end self-end' : 'items-start self-start')}
              >
                <p className={cn('whitespace-pre-wrap break-words rounded-[20px] px-4 py-2.5 text-base', propria ? 'rounded-br-md bg-primary text-primary-fg' : 'rounded-bl-md bg-surface-2')}>
                  {m.texto}
                </p>
                <span className="px-1 text-caption text-fg-muted">
                  {quem} · {fmtDateTime(m.data)}
                </span>
              </motion.div>
            );
          })
        )}
      </div>

      <div className="flex items-end gap-2">
        <textarea
          id={inputId}
          aria-label="Escreva uma mensagem"
          placeholder="Escreva uma mensagem..."
          rows={2}
          maxLength={1000}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={aoTeclar}
          className={cn(fieldClasses, 'max-h-32 min-h-12 flex-1 resize-none py-3')}
        />
        <button
          type="button"
          data-testid={sendTestId}
          onClick={enviar}
          disabled={enviando}
          aria-label="Enviar mensagem"
          className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-fg shadow-xs outline-none transition-[background-color,transform] hover:bg-primary-hover focus-visible:ring-4 focus-visible:ring-primary/30 active:scale-95 disabled:opacity-50"
        >
          <SendHorizontal className="size-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
