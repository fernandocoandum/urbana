'use client';

import { ArrowLeft, CheckCircle2, RotateCcw, SearchX, ShieldCheck, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { AvaliacaoCard, DescricaoCard, Historico, LocalCard, ResumoCard } from '@/features/ocorrencias/components/detalhe-partes';
import { ProtocoloChip } from '@/features/ocorrencias/components/protocolo-chip';
import { useOcorrencia } from '@/features/ocorrencias/hooks';
import { pedidoPendente } from '@/features/ocorrencias/proxima-acao';
import { api } from '@/lib/api-client';
import type { OcorrenciaDerivada } from '@/lib/db/types';
import { fmtDateTime } from '@/lib/format';
import { DialogResolver, estadoInicial, FormEncaminhar, FormStatus, useSalvarStatus, type EstadoForm } from './gestao-forms';

type Aba = 'detalhes' | 'status' | 'encaminhar' | 'conversa';

function Esqueleto() {
  return (
    <Container size="admin">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="mt-6 h-10 w-3/4 max-w-xl" />
      <Skeleton className="mt-4 h-9 w-72" />
      <Skeleton className="mt-8 h-72 rounded-xl" />
    </Container>
  );
}

export function GestaoView({ id }: { id: string }) {
  const { data: o, error, mutate } = useOcorrencia(id);
  const { mutate: mutateGlobal } = useSWRConfig();
  const carregou = !!o;

  // Ao abrir, marca como lida e atualiza o selo da barra lateral e a fila.
  useEffect(() => {
    if (!carregou) return;
    api('POST', `/api/ocorrencias/${encodeURIComponent(id)}/marcar-lida`)
      .then(() => Promise.all([mutateGlobal('/api/stats'), mutateGlobal('/api/ocorrencias')]))
      .catch(() => { /* a leitura não pode derrubar a tela */ });
  }, [id, carregou, mutateGlobal]);

  if (error) {
    return (
      <Container size="admin">
        <Card>
          <EmptyState icon={SearchX} title="Ocorrência não encontrada" description={error.message} action={<Button asChild variant="secondary"><Link href="/admin/ocorrencias">Voltar para a fila</Link></Button>} />
        </Card>
      </Container>
    );
  }
  if (!o) return <Esqueleto />;
  return <Gestao o={o} mutate={mutate} />;
}

function Gestao({ o, mutate }: { o: OcorrenciaDerivada; mutate: () => Promise<unknown> }) {
  const { mutate: mutateGlobal } = useSWRConfig();
  const desktop = useMediaQuery('(min-width: 1024px)', { initializeWithValue: false, defaultValue: false });
  const [aba, setAba] = useState<Aba>('detalhes');
  const [resolvendo, setResolvendo] = useState(false);
  const [form, setFormCompleto] = useState<EstadoForm>(() => estadoInicial(o));
  const setForm = useCallback((p: Partial<EstadoForm>) => setFormCompleto((f) => ({ ...f, ...p })), []);
  const pendente = pedidoPendente(o);

  const depois = useCallback(async () => {
    await Promise.all([mutate(), mutateGlobal('/api/ocorrencias'), mutateGlobal('/api/stats')]);
  }, [mutate, mutateGlobal]);
  const { salvando, salvar } = useSalvarStatus(o, depois);

  // Depois de salvar, o formulário parte dos valores novos (a ocorrência volta do servidor atualizada).
  const aoSalvar = useCallback(() => {
    setFormCompleto((f) => ({ ...f, obs: '', evidencia: '', obsEncaminhar: '' }));
  }, []);
  // Se o status vindo do servidor muda (depois de salvar, ou outra pessoa mexeu), o campo acompanha.
  const [statusVisto, setStatusVisto] = useState(o.status);
  if (statusVisto !== o.status) {
    setStatusVisto(o.status);
    setFormCompleto((f) => ({ ...f, status: o.status }));
  }

  const thread = useMemo(
    () => (o.mensagens || []).map((m) => ({ id: m.id, autor: m.de, nome: m.de === 'prefeitura' ? 'Prefeitura' : o.nomeUsuario || 'Cidadão', texto: m.texto, data: m.data })),
    [o.mensagens, o.nomeUsuario],
  );
  const enviarMensagem = async (texto: string) => {
    await api('POST', `/api/ocorrencias/${encodeURIComponent(o.id)}/mensagens`, { texto });
    await mutate();
  };

  function responderPedido(status: 'Em análise' | 'Resolvida') {
    setForm({ status, obs: status === 'Em análise' ? 'Reaberta a pedido do cidadão.' : '' });
    setAba('status');
    setTimeout(() => document.getElementById('gestao-obs')?.focus(), 150);
  }

  const abaPainel: Exclude<Aba, 'detalhes'> = aba === 'detalhes' ? 'status' : aba;
  const propsForm = { o, form, setForm, salvar, salvando, onSalvo: aoSalvar };

  const painelStatus = <FormStatus {...propsForm} />;
  const painelEncaminhar = <FormEncaminhar {...propsForm} />;
  const painelConversa = <MessageThread variant="ocorrencia" mensagens={thread} ladoProprio="prefeitura" onSend={enviarMensagem} inputId="gestao-msg-input" sendTestId="gestao-msg-enviar" />;

  const banner = pendente && (
    <div role="region" aria-label="Pedido de reabertura" className="flex flex-col gap-4 rounded-xl border border-warning/30 bg-warning-soft p-5 sm:p-6">
      <div className="flex gap-3">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        <div className="min-w-0">
          <p className="text-base font-semibold">O cidadão pediu a reabertura</p>
          <p className="mt-1 break-words text-base">&ldquo;{pendente.motivo}&rdquo;</p>
          <p className="mt-1 text-sm text-fg-muted">Em {fmtDateTime(pendente.data)}</p>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={() => responderPedido('Em análise')}><RotateCcw aria-hidden /> Reabrir (Em análise)</Button>
        <Button variant="secondary" onClick={() => responderPedido('Resolvida')}><ShieldCheck aria-hidden /> Manter resolvida</Button>
      </div>
    </div>
  );

  const principal = (
    <>
      <ResumoCard o={o} pendente={pendente} perspectiva="admin" />
      <LocalCard o={o} />
      <DescricaoCard o={o} />
      <AvaliacaoCard o={o} perspectiva="admin" />
      <Historico historico={o.historico || []} />
    </>
  );

  const tabsPainel = [
    { value: 'status', label: 'Status' },
    { value: 'encaminhar', label: 'Encaminhar' },
    { value: 'conversa', label: 'Conversa', count: (o.mensagens || []).length },
  ];

  return (
    <Container size="admin">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href="/admin/ocorrencias">
          <ArrowLeft aria-hidden /> Fila de atendimento
        </Link>
      </Button>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1 basis-80">
          <h1 className="break-words text-3xl font-semibold tracking-[-.015em]">{o.titulo}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <ProtocoloChip protocolo={o.protocolo} />
            <StatusBadge status={o.status} />
            {o.atrasada && <span className="inline-flex h-7 items-center rounded-full bg-danger-soft px-3 text-sm font-medium text-danger">Atrasada</span>}
            <span className="text-sm text-fg-muted">Aberta em {fmtDateTime(o.criadoEm)} por {o.nomeUsuario || 'Cidadão'}</span>
          </div>
        </div>
        {o.status !== 'Resolvida' && (
          <Button size="lg" onClick={() => setResolvendo(true)} className="w-full sm:w-auto">
            <CheckCircle2 aria-hidden /> Marcar resolvida
          </Button>
        )}
      </header>

      {banner && <div className="mt-8">{banner}</div>}

      {desktop ? (
        <>
          <Card className="mt-8 py-8">
            <StepperStatus status={o.status} orientation="horizontal" />
          </Card>
          <div className="mt-8 grid grid-cols-[minmax(0,1fr)_380px] items-start gap-8">
            <div className="flex min-w-0 flex-col gap-6">{principal}</div>
            <aside className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto" aria-label="Gestão da ocorrência">
              <Card>
                <CardHeader><CardTitle>Gestão</CardTitle></CardHeader>
                <AnimatedTabs tabs={tabsPainel} value={abaPainel} onValueChange={(v) => setAba(v as Aba)} fullWidth aria-label="Ações de gestão">
                  <AnimatedTabsPanel value="status" className="mt-6">{painelStatus}</AnimatedTabsPanel>
                  <AnimatedTabsPanel value="encaminhar" className="mt-6">{painelEncaminhar}</AnimatedTabsPanel>
                  <AnimatedTabsPanel value="conversa" className="mt-6">{painelConversa}</AnimatedTabsPanel>
                </AnimatedTabs>
              </Card>
            </aside>
          </div>
        </>
      ) : (
        <AnimatedTabs
          tabs={[{ value: 'detalhes', label: 'Detalhes' }, ...tabsPainel.map((t) => (t.value === 'conversa' ? { ...t, label: 'Conversa' } : t))]}
          value={aba}
          onValueChange={(v) => setAba(v as Aba)}
          fullWidth
          className="mt-8"
          aria-label="Seções da ocorrência"
        >
          <AnimatedTabsPanel value="detalhes" className="mt-6 flex flex-col gap-6">
            <Card><StepperStatus status={o.status} orientation="vertical" /></Card>
            {principal}
          </AnimatedTabsPanel>
          <AnimatedTabsPanel value="status" className="mt-6"><Card>{painelStatus}</Card></AnimatedTabsPanel>
          <AnimatedTabsPanel value="encaminhar" className="mt-6"><Card>{painelEncaminhar}</Card></AnimatedTabsPanel>
          <AnimatedTabsPanel value="conversa" className="mt-6"><Card>{painelConversa}</Card></AnimatedTabsPanel>
        </AnimatedTabs>
      )}

      <DialogResolver o={o} open={resolvendo} onOpenChange={setResolvendo} salvar={salvar} salvando={salvando} onSalvo={aoSalvar} />
    </Container>
  );
}
