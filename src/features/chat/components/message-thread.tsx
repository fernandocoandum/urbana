'use client';

// Conversa reutilizável: a "Conversa da cidade" (variant 'praça') e a conversa de cada ocorrência
// (variant 'ocorrencia', compacta, sem avatares). Agrupa mensagens por autor e por dia, envia de
// forma otimista, avisa de mensagens novas quando a pessoa não está no fim e cresce o compositor.
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, ArrowDown, Clock, SendHorizontal } from 'lucide-react';
import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { fieldClasses } from '@/components/ui/input';
import { fmtHora } from '@/lib/format';
import { spring } from '@/lib/motion';
import { Sound } from '@/lib/sound';
import { cn } from '@/lib/utils';
import { agruparMensagens, type Dia, type Grupo } from '../agrupar-mensagens';

export interface ThreadMsg {
  id: string;
  /** Quem escreveu: id do usuário (praça) ou 'cidadao' | 'prefeitura' (ocorrência). */
  autor: string;
  nome: string;
  foto?: string | null;
  texto: string;
  data: string;
}

type Pendente = ThreadMsg & { status: 'enviando' | 'erro'; erro?: string };
type Item = ThreadMsg & { status?: Pendente['status']; erro?: string };

interface Props {
  mensagens: ThreadMsg[];
  /** Valor de `autor` que identifica as mensagens da própria pessoa (bolha à direita). */
  ladoProprio: string;
  /** Deve rejeitar com Error em caso de falha: a bolha fica com "Tentar de novo". */
  onSend: (texto: string) => Promise<void>;
  variant?: 'praça' | 'ocorrencia';
  /** Praça: abre o perfil público ao clicar no avatar ou no nome. */
  onAbrirPerfil?: (autorId: string) => void;
  /** id do textarea e data-testid do botão de enviar (seletores dos testes). */
  inputId?: string;
  sendTestId?: string;
  className?: string;
}

const LIMITE = { 'praça': 500, ocorrencia: 1000 } as const;
const MAX_LINHAS = 5;

export function MessageThread({ mensagens, ladoProprio, onSend, variant = 'ocorrencia', onAbrirPerfil, inputId, sendTestId, className }: Props) {
  const praca = variant === 'praça';
  const limite = LIMITE[variant];
  const [texto, setTexto] = useState('');
  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const [novas, setNovas] = useState(0);
  // Mensagens que já estavam na tela ao montar não animam; só as que chegam depois.
  const [jaVistas] = useState(() => new Set(mensagens.map((m) => m.id)));
  const rolagem = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const noFim = useRef(true);
  const anterior = useRef<{ total: number; primeira: boolean }>({ total: 0, primeira: true });
  const seq = useRef(0);

  const itens: Item[] = useMemo(() => [...mensagens, ...pendentes], [mensagens, pendentes]);
  const dias = useMemo(() => agruparMensagens(itens), [itens]);

  const irParaOFim = useCallback((suave: boolean) => {
    const el = rolagem.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: suave ? 'smooth' : 'instant' });
    noFim.current = true;
    setNovas(0);
  }, []);

  // Chegada de mensagens: rola quando já se está no fim (ou quando a mensagem é da própria pessoa);
  // senão acende a pílula "Novas mensagens". O primeiro render só posiciona no fim, sem animar.
  useLayoutEffect(() => {
    const total = itens.length;
    const ant = anterior.current;
    if (ant.primeira) {
      anterior.current = { total, primeira: false };
      irParaOFim(false);
      return;
    }
    const adicionadas = total - ant.total;
    anterior.current = { total, primeira: false };
    if (adicionadas <= 0) return;
    const ultima = itens[total - 1]!;
    const minha = ultima.autor === ladoProprio;
    if (!minha) Sound.play('notify');
    if (minha || noFim.current) irParaOFim(true);
    else setNovas((n) => n + adicionadas);
  }, [itens, ladoProprio, irParaOFim]);

  // O compositor cresce até 5 linhas.
  useLayoutEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = 'auto';
    const estilo = getComputedStyle(el);
    const linha = parseFloat(estilo.lineHeight) || 24;
    const extra = parseFloat(estilo.paddingTop) + parseFloat(estilo.paddingBottom) + parseFloat(estilo.borderTopWidth) + parseFloat(estilo.borderBottomWidth);
    el.style.height = `${Math.min(el.scrollHeight, linha * MAX_LINHAS + extra)}px`;
  }, [texto]);

  function aoRolar() {
    const el = rolagem.current;
    if (!el) return;
    const longe = el.scrollHeight - el.scrollTop - el.clientHeight;
    noFim.current = longe < 80;
    if (noFim.current) setNovas(0);
  }

  const disparar = useCallback(
    async (id: string, t: string) => {
      try {
        await onSend(t);
        setPendentes((p) => p.filter((x) => x.id !== id));
      } catch (err) {
        const erro = err instanceof Error ? err.message : 'não foi possível enviar';
        setPendentes((p) => p.map((x) => (x.id === id ? { ...x, status: 'erro', erro } : x)));
      }
    },
    [onSend],
  );

  function enviar() {
    const t = texto.trim();
    if (!t) return;
    const id = `pendente-${Date.now()}-${seq.current++}`;
    setPendentes((p) => [...p, { id, autor: ladoProprio, nome: 'Você', texto: t, data: new Date().toISOString(), status: 'enviando' }]);
    setTexto('');
    Sound.play('send');
    void disparar(id, t);
  }

  const tentarDeNovo = useCallback(
    (id: string) => {
      const alvo = pendentes.find((x) => x.id === id);
      if (!alvo) return;
      setPendentes((p) => p.map((x) => (x.id === id ? { ...x, status: 'enviando', erro: undefined } : x)));
      void disparar(id, alvo.texto);
    },
    [pendentes, disparar],
  );
  const descartar = useCallback((id: string) => setPendentes((p) => p.filter((x) => x.id !== id)), []);

  function aoTeclar(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      enviar();
    }
  }

  const vazio = itens.length === 0;
  const restante = limite - texto.length;
  const podeEnviar = texto.trim().length > 0;

  return (
    <div className={cn('flex flex-col', praca ? 'h-full min-h-0' : 'gap-4', className)}>
      <div className={cn('relative', praca ? 'min-h-0 flex-1' : 'h-[420px]')}>
        <div
          ref={rolagem}
          onScroll={aoRolar}
          role="log"
          aria-label={praca ? 'Mensagens da cidade' : 'Mensagens'}
          aria-live="polite"
          tabIndex={0}
          className={cn(
            'h-full overflow-y-auto overscroll-contain outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
            praca ? 'px-4 sm:px-6' : 'rounded-xl bg-bg px-4',
          )}
        >
          <div className={cn('flex min-h-full flex-col py-6', praca ? 'gap-8' : 'gap-6')}>
            {vazio ? (
              <p className="m-auto max-w-64 text-center text-base text-fg-muted">
                {praca ? 'Ainda não há mensagens. Puxe a conversa com seus vizinhos.' : 'Nenhuma mensagem ainda. Escreva abaixo para falar com a prefeitura.'}
              </p>
            ) : (
              dias.map((dia) => (
                <DiaSecao
                  key={dia.chave}
                  dia={dia}
                  ladoProprio={ladoProprio}
                  praca={praca}
                  jaVistas={jaVistas}
                  onAbrirPerfil={onAbrirPerfil}
                  onRetry={tentarDeNovo}
                  onDiscard={descartar}
                />
              ))
            )}
          </div>
        </div>

        <AnimatePresence>
          {novas > 0 && (
            <motion.button
              type="button"
              onClick={() => irParaOFim(true)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8, transition: { duration: 0.12 } }}
              transition={spring.smooth}
              className="absolute bottom-4 left-1/2 z-20 flex h-10 -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-fg shadow-lg outline-none focus-visible:ring-4 focus-visible:ring-primary/30"
            >
              Novas mensagens
              <ArrowDown className="size-4" aria-hidden />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className={cn(praca && 'border-t border-border bg-surface px-4 pb-4 pt-4 sm:px-6')}>
        <div className="relative flex items-end gap-3">
          <textarea
            ref={campo}
            id={inputId}
            aria-label="Escreva uma mensagem"
            placeholder={praca ? 'Escreva uma mensagem pública...' : 'Sua mensagem...'}
            rows={1}
            maxLength={limite}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={aoTeclar}
            className={cn(fieldClasses, 'min-h-12 flex-1 resize-none rounded-[24px] py-[10px] leading-6', praca ? 'px-5' : 'px-4')}
          />
          {restante <= 50 && (
            <span aria-live="polite" className={cn('tabular absolute -top-5 right-14 text-caption', restante <= 10 ? 'text-danger' : 'text-fg-subtle')}>
              {texto.length}/{limite}
            </span>
          )}
          <button
            type="button"
            data-testid={sendTestId}
            onClick={enviar}
            disabled={!podeEnviar}
            aria-label="Enviar mensagem"
            className="mb-0.5 grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-fg shadow-xs outline-none transition-[background-color,transform,opacity] hover:bg-primary-hover focus-visible:ring-4 focus-visible:ring-primary/30 active:scale-95 disabled:opacity-40"
          >
            <SendHorizontal className="size-5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

interface DiaProps {
  dia: Dia<Item>;
  ladoProprio: string;
  praca: boolean;
  jaVistas: Set<string>;
  onAbrirPerfil?: (autorId: string) => void;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
}

const DiaSecao = memo(function DiaSecao({ dia, ladoProprio, praca, jaVistas, onAbrirPerfil, onRetry, onDiscard }: DiaProps) {
  return (
    <section aria-label={dia.rotulo} className="flex flex-col gap-5">
      <h3 className={cn('z-10 mx-auto w-fit rounded-full border border-border bg-surface px-3 py-1 text-caption font-medium tracking-[.02em] text-fg-muted shadow-sm', praca && 'sticky top-3')}>
        {dia.rotulo}
      </h3>
      {dia.grupos.map((g) => (
        <GrupoView key={g.mensagens[0]!.id} grupo={g} propria={g.autor === ladoProprio} praca={praca} jaVistas={jaVistas} onAbrirPerfil={onAbrirPerfil} onRetry={onRetry} onDiscard={onDiscard} />
      ))}
    </section>
  );
});

function GrupoView({
  grupo,
  propria,
  praca,
  jaVistas,
  onAbrirPerfil,
  onRetry,
  onDiscard,
}: { grupo: Grupo<Item>; propria: boolean; praca: boolean; jaVistas: Set<string>; onAbrirPerfil?: (id: string) => void; onRetry: (id: string) => void; onDiscard: (id: string) => void }) {
  const primeira = grupo.mensagens[0]!;
  const ultima = grupo.mensagens[grupo.mensagens.length - 1]!;
  const nome = propria ? 'Você' : praca ? primeira.nome : primeira.autor === 'prefeitura' ? 'Prefeitura' : primeira.nome;
  const mostrarAvatar = praca && !propria;
  const clicavel = praca && !propria && !!onAbrirPerfil;
  const abrir = () => onAbrirPerfil?.(grupo.autor);

  return (
    <div className={cn('flex gap-3', propria && 'flex-row-reverse')}>
      {mostrarAvatar && (
        <div className="shrink-0 pt-0.5">
          {clicavel ? (
            <button type="button" onClick={abrir} aria-label={`Ver perfil de ${nome}`} className="rounded-full outline-none transition-transform hover:scale-105 focus-visible:ring-4 focus-visible:ring-primary/25">
              <Avatar nome={nome} foto={primeira.foto} size="sm" />
            </button>
          ) : (
            <Avatar nome={nome} foto={primeira.foto} size="sm" />
          )}
        </div>
      )}
      <div className={cn('flex min-w-0 flex-col gap-1', praca ? 'max-w-[75%]' : 'max-w-[85%]', propria ? 'items-end' : 'items-start')}>
        {(!propria || !praca) && (
          <div className="px-1 text-sm font-semibold leading-5">
            {clicavel ? (
              <button type="button" onClick={abrir} className="rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary/40">
                {nome}
              </button>
            ) : (
              <span className={propria ? 'text-fg-muted' : undefined}>{nome}</span>
            )}
          </div>
        )}
        {grupo.mensagens.map((m) => {
          const animar = !jaVistas.has(m.id) && (!propria || !!m.status);
          return (
            <motion.div
              key={m.id}
              initial={animar ? { opacity: 0, y: 8 } : false}
              animate={{ opacity: m.status === 'enviando' ? 0.6 : 1, y: 0 }}
              transition={spring.smooth}
              className={cn('flex max-w-full', propria ? 'justify-end' : 'justify-start')}
            >
              <p
                className={cn(
                  'whitespace-pre-wrap break-words rounded-[20px] px-4 py-2.5 text-base leading-6',
                  propria ? 'rounded-br-[6px] bg-primary text-primary-fg' : 'rounded-bl-[6px] bg-surface-2 text-fg',
                  m.status === 'erro' && 'ring-2 ring-danger/60',
                )}
              >
                {m.texto}
              </p>
            </motion.div>
          );
        })}
        <Rodape item={ultima} onRetry={onRetry} onDiscard={onDiscard} />
      </div>
    </div>
  );
}

function Rodape({ item, onRetry, onDiscard }: { item: Item; onRetry: (id: string) => void; onDiscard: (id: string) => void }) {
  if (item.status === 'enviando') {
    return (
      <span className="flex items-center gap-1.5 px-1 text-caption text-fg-subtle">
        <Clock className="size-3" aria-hidden /> Enviando…
      </span>
    );
  }
  if (item.status === 'erro') {
    return (
      <span role="alert" className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 px-1 text-sm text-danger">
        <AlertCircle className="size-4" aria-hidden />
        Não enviada
        <button type="button" onClick={() => onRetry(item.id)} className="rounded-sm font-semibold underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-danger/40">
          Tentar de novo
        </button>
        <button type="button" onClick={() => onDiscard(item.id)} className="rounded-sm text-fg-muted underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
          Descartar
        </button>
      </span>
    );
  }
  return <span className="px-1 text-caption text-fg-subtle tabular">{fmtHora(item.data)}</span>;
}
