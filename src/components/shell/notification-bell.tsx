'use client';

import { BellRing, CheckCheck, Bell, MessageCircle, RefreshCcw, Route } from 'lucide-react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { useMediaQuery } from 'usehooks-ts';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tip } from '@/components/ui/tooltip';
import { api, fetcher } from '@/lib/api-client';
import { tempoRelativo } from '@/lib/format';
import { staggerDelay } from '@/lib/motion';
import { Sound } from '@/lib/sound';
import { cn } from '@/lib/utils';
import type { Notificacao, TipoNotificacao } from '@/lib/db/types';

interface Resposta { itens: Notificacao[]; naoLidas: number }

const CHAVE = '/api/notificacoes';
const ICONE: Record<TipoNotificacao, typeof Bell> = { status: Route, mensagem: MessageCircle, reabertura: RefreshCcw };

function Lista({ dados, carregando, erro, onAbrir, onTodas }: { dados?: Resposta; carregando: boolean; erro: boolean; onAbrir: (n: Notificacao) => void; onTodas: () => void }) {
  const itens = dados?.itens ?? [];
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-3 px-4 py-3 max-md:px-0 max-md:pt-0">
        <p className="text-base font-semibold" aria-live="polite">
          {dados && dados.naoLidas > 0 ? `${dados.naoLidas} ${dados.naoLidas === 1 ? 'nova' : 'novas'}` : 'Notificações'}
        </p>
        <Button variant="ghost" size="sm" onClick={onTodas} disabled={!dados || dados.naoLidas === 0}>
          <CheckCheck aria-hidden /> Marcar todas como lidas
        </Button>
      </div>
      <div className="border-t border-border max-md:-mx-6" />
      {carregando && !dados ? (
        <div className="flex flex-col gap-3 p-4">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : erro && !dados ? (
        <p className="px-4 py-10 text-center text-base text-fg-muted">Não foi possível carregar agora. Tente de novo em instantes.</p>
      ) : itens.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-primary-soft text-primary"><Bell className="size-5" aria-hidden /></span>
          <p className="mt-4 text-base font-medium">Tudo em dia</p>
          <p className="mt-1 text-sm text-fg-muted">Avisamos aqui quando a prefeitura atualizar uma ocorrência sua.</p>
        </div>
      ) : (
        <ul className="max-h-[min(420px,60dvh)] overflow-y-auto overscroll-contain py-1 max-md:max-h-none">
          {itens.map((n, i) => {
            const Icone = ICONE[n.tipo] ?? Bell;
            return (
              <motion.li key={n.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: staggerDelay(i), duration: 0.2 }}>
                <button
                  type="button"
                  onClick={() => onAbrir(n)}
                  className={cn('flex w-full items-start gap-3 px-4 py-3.5 text-left outline-none transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 max-md:px-2', !n.lida && 'bg-primary-soft/50')}
                >
                  <span className={cn('mt-0.5 grid size-9 shrink-0 place-items-center rounded-full', n.lida ? 'bg-surface-2 text-fg-muted' : 'bg-primary-soft text-primary')}>
                    <Icone className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm leading-snug', n.lida ? 'font-medium' : 'font-semibold')}>{n.titulo}</span>
                    {n.texto && <span className="mt-1 line-clamp-2 block text-sm leading-snug text-fg-muted">{n.texto}</span>}
                    <span className="mt-1.5 block text-xs text-fg-subtle">{tempoRelativo(n.criadoEm)}</span>
                  </span>
                  {!n.lida && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-primary" aria-label="Não lida" />}
                </button>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Sino do cidadão: contador, lista (popover no desktop, sheet no celular) e marcação de lidas. Polling de 30 s. */
export function NotificationBell() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const desktop = useMediaQuery('(min-width: 768px)', { initializeWithValue: false, defaultValue: true });
  const { data, error, isLoading, mutate } = useSWR<Resposta>(CHAVE, fetcher, { refreshInterval: 30_000, revalidateOnFocus: true });
  const naoLidas = data?.naoLidas ?? 0;

  // Toca o som só quando o contador SOBE depois da primeira leitura.
  const anterior = useRef<number | null>(null);
  useEffect(() => {
    if (!data) return;
    if (anterior.current !== null && data.naoLidas > anterior.current) Sound.play('notify');
    anterior.current = data.naoLidas;
  }, [data]);

  const marcar = async (ids?: string[]) => {
    const atual = data;
    if (!atual) return;
    const alvo = ids ? new Set(ids) : null;
    const itens = atual.itens.map((n) => (!alvo || alvo.has(n.id) ? { ...n, lida: true } : n));
    const viradas = atual.itens.filter((n) => !n.lida && (!alvo || alvo.has(n.id))).length;
    const otimista: Resposta = { itens, naoLidas: alvo ? Math.max(0, atual.naoLidas - viradas) : 0 };
    try {
      await mutate(
        async () => {
          await api('POST', '/api/notificacoes/lidas', ids ? { ids } : {});
          return fetcher<Resposta>(CHAVE);
        },
        { optimisticData: otimista, rollbackOnError: true, revalidate: false },
      );
    } catch { /* o próximo polling corrige o estado */ }
  };

  const abrir = (n: Notificacao) => {
    setAberto(false);
    if (!n.lida) void marcar([n.id]);
    router.push(`/ocorrencias/${encodeURIComponent(n.ocorrenciaId)}`);
  };

  const label = naoLidas > 0 ? `Notificações, ${naoLidas} não ${naoLidas === 1 ? 'lida' : 'lidas'}` : 'Notificações';
  const gatilho = (
    <Button variant="ghost" size="icon" aria-label={label} className="relative">
      {naoLidas > 0 ? <BellRing /> : <Bell />}
      {naoLidas > 0 && (
        <motion.span
          key={naoLidas}
          initial={{ scale: 0.6 }}
          animate={{ scale: 1 }}
          data-testid="sino-contador"
          className="absolute right-0.5 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[11px] font-semibold leading-none text-primary-fg ring-2 ring-surface"
        >
          {naoLidas > 99 ? '99+' : naoLidas}
        </motion.span>
      )}
    </Button>
  );
  const lista = <Lista dados={data} carregando={isLoading} erro={!!error} onAbrir={abrir} onTodas={() => void marcar()} />;

  if (!desktop) {
    return (
      <Sheet open={aberto} onOpenChange={setAberto}>
        <Tip label="Notificações"><SheetTrigger asChild>{gatilho}</SheetTrigger></Tip>
        <SheetContent side="bottom" title="Notificações" hideTitle>{lista}</SheetContent>
      </Sheet>
    );
  }
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <Tip label="Notificações"><PopoverTrigger asChild>{gatilho}</PopoverTrigger></Tip>
      <PopoverContent className="w-[min(400px,calc(100vw-24px))]" aria-label="Notificações">{lista}</PopoverContent>
    </Popover>
  );
}
