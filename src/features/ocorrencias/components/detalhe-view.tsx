'use client';

import { ArrowLeft, SearchX } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSWRConfig } from 'swr';
import { useMediaQuery } from 'usehooks-ts';
import { Container } from '@/components/layout/page';
import { AnimatedTabs, AnimatedTabsPanel } from '@/components/ui/animated-tabs';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { StepperStatus } from '@/components/ui/stepper-status';
import { MessageThread } from '@/features/chat/components/message-thread';
import { api } from '@/lib/api-client';
import { fmtDateTime } from '@/lib/format';
import { useOcorrencia } from '../hooks';
import { pedidoPendente } from '../proxima-acao';
import { AvaliacaoCard, DescricaoCard, Historico, LocalCard, ReaberturaCard, ResumoCard } from './detalhe-partes';
import { ProtocoloChip } from './protocolo-chip';

const ABAS = [
  { value: 'resumo', label: 'Resumo' },
  { value: 'conversa', label: 'Conversa' },
  { value: 'historico', label: 'Histórico' },
];

export function DetalheView({ id }: { id: string }) {
  const { data: o, error, mutate } = useOcorrencia(id);
  const { mutate: mutateGlobal } = useSWRConfig();
  const desktop = useMediaQuery('(min-width: 1024px)', { initializeWithValue: false, defaultValue: false });
  const [aba, setAba] = useState('resumo');
  const carregou = !!o;
  const mensagensBrutas = o?.mensagens;
  const thread = useMemo(
    () => (mensagensBrutas || []).map((m) => ({ id: m.id, autor: m.de, nome: m.de === 'prefeitura' ? 'Prefeitura' : 'Você', texto: m.texto, data: m.data })),
    [mensagensBrutas],
  );

  // Ao abrir, marca como lida (e atualiza o ponto azul da lista).
  useEffect(() => {
    if (!carregou) return;
    api('POST', `/api/ocorrencias/${encodeURIComponent(id)}/marcar-lida`)
      .then(() => mutateGlobal('/api/ocorrencias'))
      .catch(() => { /* a leitura não pode derrubar a tela */ });
  }, [id, carregou, mutateGlobal]);

  if (error) {
    return (
      <Container size="read">
        <Card>
          <EmptyState
            icon={SearchX}
            title="Ocorrência não encontrada"
            description={error.message}
            action={<Button asChild variant="secondary"><Link href="/ocorrencias">Voltar para minhas ocorrências</Link></Button>}
          />
        </Card>
      </Container>
    );
  }

  if (!o) {
    return (
      <Container>
        <Skeleton className="h-9 w-40" />
        <Skeleton className="mt-6 h-10 w-3/4 max-w-xl" />
        <Skeleton className="mt-4 h-9 w-72" />
        <Skeleton className="mt-8 h-72 rounded-xl" />
      </Container>
    );
  }

  const pendente = pedidoPendente(o);
  const enviarMensagem = async (texto: string) => {
    await api('POST', `/api/ocorrencias/${encodeURIComponent(o.id)}/mensagens`, { texto });
    await mutate();
  };
  const atualizar = () => { void mutate(); void mutateGlobal('/api/ocorrencias'); };

  const conversa = <MessageThread variant="ocorrencia" mensagens={thread} ladoProprio="cidadao" onSend={enviarMensagem} inputId="mdet-msg-input" />;

  return (
    <Container>
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href="/ocorrencias">
          <ArrowLeft aria-hidden /> Minhas ocorrências
        </Link>
      </Button>

      <header className="mt-4">
        <h1 className="break-words text-3xl font-semibold tracking-[-.015em]">{o.titulo}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <ProtocoloChip protocolo={o.protocolo} />
          <StatusBadge status={o.status} />
          <span className="text-sm text-fg-muted">Aberta em {fmtDateTime(o.criadoEm)}</span>
        </div>
      </header>

      {desktop ? (
        <>
          <Card className="mt-8 py-8">
            <StepperStatus status={o.status} orientation="horizontal" />
          </Card>
          <div className="mt-8 grid grid-cols-3 items-start gap-8">
            <div className="col-span-2 flex flex-col gap-6">
              <ResumoCard o={o} pendente={pendente} />
              <LocalCard o={o} />
              <DescricaoCard o={o} />
              <Historico historico={o.historico || []} />
            </div>
            <aside className="sticky top-24 flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Conversa com a prefeitura</CardTitle>
                </CardHeader>
                {conversa}
              </Card>
              <AvaliacaoCard o={o} onDone={atualizar} />
              <ReaberturaCard o={o} pendente={pendente} onDone={atualizar} />
            </aside>
          </div>
        </>
      ) : (
        <AnimatedTabs tabs={ABAS} value={aba} onValueChange={setAba} fullWidth className="mt-8" aria-label="Seções da ocorrência">
          <AnimatedTabsPanel value="resumo" className="mt-6 flex flex-col gap-6">
            <Card>
              <StepperStatus status={o.status} orientation="vertical" />
            </Card>
            <ResumoCard o={o} pendente={pendente} />
            <LocalCard o={o} />
            <DescricaoCard o={o} />
          </AnimatedTabsPanel>
          <AnimatedTabsPanel value="conversa" className="mt-6 flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Conversa com a prefeitura</CardTitle>
              </CardHeader>
              {conversa}
            </Card>
            <AvaliacaoCard o={o} onDone={atualizar} />
            <ReaberturaCard o={o} pendente={pendente} onDone={atualizar} />
          </AnimatedTabsPanel>
          <AnimatedTabsPanel value="historico" className="mt-6">
            <Historico historico={o.historico || []} />
          </AnimatedTabsPanel>
        </AnimatedTabs>
      )}
    </Container>
  );
}
