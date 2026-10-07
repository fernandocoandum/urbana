'use client';

import { Check, Copy } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/ui/category-icon';
import { StatusBadge } from '@/components/ui/status-badge';
import { spring } from '@/lib/motion';
import { useCopiarProtocolo } from '../components/protocolo-chip';
import { formatarDataTicket, gerarBarras } from './ticket-utils';

export interface TicketData {
  protocolo: string;
  titulo: string;
  categoria: string;
  bairro: string;
  endereco: string;
  data: Date;
}

/** Confete saindo do ícone de sucesso; pulado com reduced motion. Carrega a biblioteca sob demanda. */
function useConfete(alvo: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let cancelado = false;
    let t: ReturnType<typeof setTimeout>;
    import('canvas-confetti').then(({ default: confetti }) => {
      if (cancelado) return;
      // espera o ticket assentar (spring bouncy) para medir onde está o ícone
      t = setTimeout(() => {
        const r = alvo.current?.getBoundingClientRect();
        const x = r && r.width ? (r.left + r.width / 2) / window.innerWidth : 0.5;
        const y = r && r.height ? (r.top + r.height / 2) / window.innerHeight : 0.4;
        const cores = ['#2563eb', '#60a5fa', '#7c3aed', '#16a34a', '#f59e0b'];
        confetti({ particleCount: 110, spread: 80, startVelocity: 36, gravity: 0.9, ticks: 220, scalar: 0.9, origin: { x, y }, colors: cores, disableForReducedMotion: true });
        setTimeout(() => confetti({ particleCount: 50, spread: 120, startVelocity: 24, origin: { x, y }, colors: cores, disableForReducedMotion: true }), 180);
      }, 350);
    });
    return () => { cancelado = true; clearTimeout(t); };
  }, [alvo]);
}

/** Tela de sucesso: o ticket com o protocolo "sai da impressora" (spring bouncy) e o confete. */
export function Ticket({ data }: { data: TicketData }) {
  const icone = useRef<HTMLSpanElement>(null);
  const { copiado, copiar } = useCopiarProtocolo(data.protocolo);
  useConfete(icone);
  const barras = gerarBarras(data.protocolo);

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-col items-center px-5 py-10 sm:py-14">
      <motion.div
        data-testid="ticket"
        role="group"
        aria-label="Comprovante da ocorrência"
        initial={{ opacity: 0, y: 56, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={spring.bouncy}
        className="relative w-full rounded-2xl border border-border bg-surface shadow-lg"
      >
        <div className="flex flex-col items-center px-6 pb-8 pt-8 text-center sm:px-8">
          <span ref={icone} className="grid size-16 place-items-center rounded-full bg-success-soft text-success">
            <Check className="size-8" strokeWidth={2.5} aria-hidden />
          </span>
          <h1 className="mt-5 text-3xl font-semibold tracking-[-.015em]">Obrigado!</h1>
          <p className="mt-2 text-base text-fg-muted">Sua ocorrência foi registrada com sucesso</p>
        </div>

        <Divisor />

        <div className="flex flex-col gap-6 px-6 pb-8 pt-8 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-fg-muted">Protocolo</p>
              <p id="proto-gerado" data-testid="protocolo" className="font-protocol mt-1 text-3xl font-semibold sm:text-4xl">
                {data.protocolo}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StatusBadge status="Recebida" />
            <Button variant="secondary" size="sm" onClick={copiar}>
              {copiado ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copiado ? 'Copiado' : 'Copiar protocolo'}
            </Button>
          </div>
          <div>
            <p className="text-sm text-fg-muted">Data e hora</p>
            <p className="mt-1 text-base font-medium">{formatarDataTicket(data.data)}</p>
          </div>
          <div className="flex items-center gap-4 rounded-xl bg-surface-2 p-4">
            <CategoryIcon categoria={data.categoria} />
            <div className="min-w-0">
              <p className="break-words text-base font-semibold">{data.titulo}</p>
              <p className="mt-0.5 break-words text-sm text-fg-muted">
                {data.categoria} · {data.endereco}, {data.bairro}
              </p>
            </div>
          </div>
        </div>

        <Divisor />

        <div className="flex flex-col items-center gap-2 px-6 pb-8 pt-6 text-fg sm:px-8" aria-hidden>
          <svg viewBox="0 0 250 70" className="h-[70px] w-full max-w-[250px]">
            {barras.map((b) => <rect key={b.x} x={b.x} y={10} width={b.w} height={50} fill="currentColor" />)}
          </svg>
          <p className="font-protocol text-sm tracking-[.2em] text-fg-muted">{data.protocolo}</p>
        </div>
      </motion.div>

      <p className="mt-8 text-center text-base text-fg-muted">
        Nossa equipe analisa em até <strong className="font-semibold text-fg">48 horas</strong>. Você acompanha tudo em &ldquo;Minhas ocorrências&rdquo;.
      </p>
      <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild size="lg">
          <Link href="/ocorrencias">Ver minhas ocorrências</Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/inicio">Início</Link>
        </Button>
      </div>
    </div>
  );
}

/** Linha tracejada com os recortes laterais do ticket. */
function Divisor() {
  return (
    <div aria-hidden className="relative border-t-2 border-dashed border-border">
      <span className="absolute -left-3 -top-3 size-6 rounded-full border border-border bg-bg" style={{ clipPath: 'inset(0 0 0 50%)' }} />
      <span className="absolute -right-3 -top-3 size-6 rounded-full border border-border bg-bg" style={{ clipPath: 'inset(0 50% 0 0)' }} />
    </div>
  );
}
