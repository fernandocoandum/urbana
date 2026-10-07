'use client';

import { BellRing, CheckCircle2, ClipboardList, Clock, Hourglass, Inbox, TriangleAlert, Wrench, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { CountUp } from '@/components/bits';
import { Section } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { categoriaInfo } from '@/features/ocorrencias/categorias';
import { cn } from '@/lib/utils';
import { ordenarFila, resumoOperacional } from '../fila';
import { useFilaAdmin } from '../hooks';
import { GraficoBarras, GraficoSerie } from './graficos';
import { OcorrenciaAdminCard } from './ocorrencia-admin-card';

function Indicador({ icone: Icone, rotulo, valor, sub, tom = 'primary' }: { icone: LucideIcon; rotulo: string; valor: number; sub: string; tom?: 'primary' | 'warning' | 'success' }) {
  return (
    <Card className="flex flex-col gap-4">
      <span className="flex items-center gap-3 text-sm font-medium text-fg-muted">
        <span
          aria-hidden
          className={cn('grid size-9 place-items-center rounded-full', tom === 'primary' && 'bg-primary-soft text-primary', tom === 'warning' && 'bg-warning-soft text-warning', tom === 'success' && 'bg-success-soft text-success')}
        >
          <Icone className="size-[18px]" />
        </span>
        {rotulo}
      </span>
      <span className="text-4xl font-semibold leading-none tracking-[-.02em]" data-testid={`indicador-${rotulo.toLowerCase().replace(/\s+/g, '-')}`}>
        <CountUp to={valor} duration={1.2} />
      </span>
      <span className="text-sm text-fg-muted">{sub}</span>
    </Card>
  );
}

function CartaoAtencao({ href, icone: Icone, titulo, valor, texto, destaque }: { href: string; icone: LucideIcon; titulo: string; valor: number; texto: string; destaque: boolean }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl border border-border bg-surface p-5 shadow-xs outline-none transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-px hover:border-border-strong hover:shadow-md focus-visible:ring-4 focus-visible:ring-primary/25 sm:p-6"
    >
      <span aria-hidden className={cn('grid size-12 shrink-0 place-items-center rounded-full', destaque ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-fg-muted')}>
        <Icone className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold">{titulo}</span>
        <span className="block text-sm text-fg-muted">{texto}</span>
      </span>
      <span className="tabular text-3xl font-semibold tracking-[-.02em]">{valor}</span>
    </Link>
  );
}

function Carregando() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[158px] rounded-xl" />)}
      </div>
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-[420px] rounded-xl" />
    </div>
  );
}

export function VisaoGeral() {
  const { data, error, mutate } = useFilaAdmin();
  const resumo = useMemo(() => (data ? resumoOperacional(data) : null), [data]);
  const atencao = useMemo(() => (data ? ordenarFila(data.filter((o) => o.status !== 'Resolvida'), 'criticidade').slice(0, 5) : []), [data]);
  const categorias = useMemo(() => (resumo?.categorias ?? []).map((c) => ({ nome: categoriaInfo(c.nome).curta, total: c.total })), [resumo]);
  const bairros = useMemo(() => (resumo?.bairros ?? []).slice(0, 7), [resumo]);

  if (error) {
    return (
      <Card>
        <EmptyState icon={ClipboardList} title="Não foi possível carregar" description={error.message} action={<Button variant="secondary" onClick={() => mutate()}>Tentar de novo</Button>} />
      </Card>
    );
  }
  if (!data || !resumo) return <Carregando />;
  if (resumo.total === 0) {
    return (
      <Card>
        <EmptyState icon={Inbox} title="Nenhuma ocorrência ainda" description="Assim que os cidadãos registrarem ocorrências, os indicadores aparecem aqui." />
      </Card>
    );
  }

  const tempo = resumo.tempoMedioResolucaoDias;
  return (
    <div>
      <section aria-label="Indicadores" className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        <Indicador icone={ClipboardList} rotulo="Total" valor={resumo.total} sub="ocorrências registradas" />
        <Indicador icone={Hourglass} rotulo="Pendentes" valor={resumo.pendentes} sub="ainda sem resolução" tom="warning" />
        <Indicador icone={Wrench} rotulo="Em atendimento" valor={resumo.emAtendimento} sub="equipe em campo" />
        <Indicador
          icone={CheckCircle2}
          rotulo="Resolvidas"
          valor={resumo.resolvidas}
          sub={`${resumo.taxaResolucao}% do total${tempo !== null ? ` · média de ${tempo < 1 ? 'menos de 1 dia' : `${tempo.toFixed(1).replace('.', ',')} dias`}` : ''}`}
          tom="success"
        />
      </section>

      <Section title="Atenção" className="mt-10">
        <div className="grid gap-6 md:grid-cols-3">
          <CartaoAtencao href="/admin/ocorrencias?atrasadas=1" icone={TriangleAlert} titulo="Atrasadas" texto="passaram do prazo" valor={resumo.atrasadas} destaque={resumo.atrasadas > 0} />
          <CartaoAtencao href="/admin/ocorrencias?naolidas=1" icone={BellRing} titulo="Não lidas" texto="novidades do cidadão" valor={resumo.naoLidas} destaque={resumo.naoLidas > 0} />
          <CartaoAtencao href="/admin/ocorrencias?reabertura=1" icone={Clock} titulo="Reabertura pedida" texto="aguardando retorno" valor={resumo.comReabertura} destaque={resumo.comReabertura > 0} />
        </div>
      </Section>

      <Section title="Panorama" className="mt-10">
        <div className="flex flex-col gap-6">
          <Card>
            <div className="mb-5">
              <CardTitle>Criadas e resolvidas</CardTitle>
              <CardDescription className="mt-1">Por dia, nos últimos 30 dias</CardDescription>
            </div>
            <GraficoSerie serie={resumo.serie} />
          </Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <div className="mb-5">
                <CardTitle>Por categoria</CardTitle>
                <CardDescription className="mt-1">Total de ocorrências em cada tipo de problema</CardDescription>
              </div>
              <GraficoBarras itens={categorias} unidade="ocorrências" legenda="Ocorrências por categoria" />
            </Card>
            <Card>
              <div className="mb-5">
                <CardTitle>Por bairro</CardTitle>
                <CardDescription className="mt-1">Onde os problemas se concentram</CardDescription>
              </div>
              <GraficoBarras itens={bairros} unidade="ocorrências" legenda="Ocorrências por bairro" />
            </Card>
          </div>
        </div>
      </Section>

      <Section
        title="Precisam de atenção"
        className="mt-10"
        action={<Button asChild variant="ghost" size="sm"><Link href="/admin/ocorrencias">Ver a fila</Link></Button>}
      >
        {atencao.length === 0 ? (
          <Card>
            <EmptyState icon={CheckCircle2} title="Tudo em dia" description="Não há ocorrências abertas no momento." />
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {atencao.map((o) => <OcorrenciaAdminCard key={o.id} o={o} />)}
          </div>
        )}
      </Section>
    </div>
  );
}
