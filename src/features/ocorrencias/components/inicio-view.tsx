'use client';

import { ArrowRight, CheckCircle2, ClipboardList, Map as MapIcon, MapPinPlus, Search, Wrench, type LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useState, type CSSProperties } from 'react';
import useSWR from 'swr';
import { BlurText, CountUp } from '@/components/bits';
import { Container, Section } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { CATEGORIAS, categoriaInfo, statusCssVar } from '@/features/ocorrencias/categorias';
import { useSession } from '@/features/auth/session-context';
import { useAppNativo } from '@/lib/app-nativo';
import { UrbaninhaMascote } from '@/features/urbaninha/urbaninha-mascote';
import { dataDeHojeExtenso, saudacaoPorHorario } from '@/lib/format';
import { spring, staggerDelay } from '@/lib/motion';
import { useOcorrencias } from '../hooks';
import { OcorrenciaLista } from './ocorrencia-lista';

const SAUDACAO_KEY = 'urbana:saudacao-animada';
const TITULO = 'text-3xl font-[650] tracking-[-.02em] sm:text-4xl';

interface StatsCidade { total: number; resolvida: number; atendimento: number; analise: number }

/** Saudação com BlurText só na primeira vez da sessão; depois, texto simples. */
function Saudacao({ texto }: { texto: string }) {
  const [animar, setAnimar] = useState<boolean | null>(null);
  useEffect(() => {
    let jaViu = true;
    try {
      jaViu = sessionStorage.getItem(SAUDACAO_KEY) === '1';
      if (!jaViu) sessionStorage.setItem(SAUDACAO_KEY, '1');
    } catch { /* storage bloqueado: sem animação */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- storage só existe no navegador
    setAnimar(!jaViu);
  }, []);

  const app = useAppNativo();
  // BlurText anima filter: blur, caro demais para o WebView do app
  if (animar && !app) return <BlurText as="h1" text={texto} delay={140} className={TITULO} />;
  // enquanto decide (SSR/hidratação), o título já ocupa o espaço, invisível, para não saltar o layout
  return (
    <h1 className={TITULO} style={{ opacity: animar === null ? 0 : 1 }}>
      {texto}
    </h1>
  );
}

/** Cidade em linhas brancas translúcidas com pins das categorias; fica atrás do mascote no destaque. */
function CidadeIlustrada({ className }: { className?: string }) {
  const predios = [
    { x: 8, w: 34, h: 70 }, { x: 46, w: 26, h: 104 }, { x: 76, w: 40, h: 56 },
    { x: 150, w: 30, h: 88 }, { x: 184, w: 42, h: 64 }, { x: 230, w: 24, h: 96 },
  ];
  const pins = [
    { x: 58, y: 34, cor: '--cat-iluminacao' }, { x: 166, y: 52, cor: '--cat-limpeza' }, { x: 242, y: 40, cor: '--cat-sinalizacao' },
  ];
  return (
    <svg viewBox="0 0 260 160" aria-hidden className={className} fill="none">
      {predios.map((p) => (
        <g key={p.x}>
          <rect x={p.x} y={150 - p.h} width={p.w} height={p.h} rx={4} fill="#fff" fillOpacity={0.12} stroke="#fff" strokeOpacity={0.22} />
          {Array.from({ length: Math.floor((p.h - 14) / 16) }, (_, i) => (
            <rect key={i} x={p.x + 7} y={150 - p.h + 10 + i * 16} width={p.w - 14} height={5} rx={2} fill="#fff" fillOpacity={0.18} />
          ))}
        </g>
      ))}
      <path d="M0 150.5h260" stroke="#fff" strokeOpacity={0.35} strokeWidth={2} />
      {pins.map((p, i) => (
        <motion.g
          key={p.x}
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}
        >
          <path d={`M${p.x} ${p.y + 16}c-4-5-8-8.5-8-13a8 8 0 0 1 16 0c0 4.5-4 8-8 13Z`} fill={`var(${p.cor})`} stroke="#fff" strokeWidth={1.5} />
          <circle cx={p.x} cy={p.y + 3} r={2.6} fill="#fff" />
        </motion.g>
      ))}
    </svg>
  );
}

function Destaque({ saudacao }: { saudacao: string }) {
  return (
    <section className="relative isolate overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#2563eb_0%,#1d4fc9_55%,#1e3a8a_100%)] p-6 text-white shadow-lg sm:p-8">
      {/* grade de ruas ao fundo */}
      <span aria-hidden className="absolute inset-0 -z-10 opacity-[.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:28px_28px]" />
      <span aria-hidden className="absolute -right-16 -top-24 -z-10 size-72 rounded-full bg-sky-300/25 blur-3xl app:hidden" />

      <div className="flex items-end gap-6">
        <div className="min-w-0 flex-1">
          <Saudacao texto={saudacao} />
          <p className="mt-1.5 text-base text-white/75" suppressHydrationWarning>
            {dataDeHojeExtenso()}
          </p>
          <p className="mt-5 max-w-[360px] text-lg font-medium leading-snug">
            Viu um problema na rua? Registre em menos de um minuto e acompanhe até resolver.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/ocorrencias/nova"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 text-base font-semibold text-[#1d4fc9] shadow-sm outline-none transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-md focus-visible:ring-4 focus-visible:ring-white/50 active:scale-[.98]"
            >
              <MapPinPlus className="size-5" aria-hidden /> Registrar ocorrência
            </Link>
            <Link
              href="/mapa"
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 text-base font-medium outline-none backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:ring-4 focus-visible:ring-white/40"
            >
              <MapIcon className="size-5" aria-hidden /> Ver o mapa
            </Link>
          </div>
        </div>

        <UrbaninhaMascote humor="acenando" className="absolute bottom-5 right-5 h-[72px] w-16 drop-shadow-[0_6px_12px_rgb(0_0_0/0.3)] sm:hidden" />
        <div className="relative hidden h-48 w-[300px] shrink-0 sm:block">
          <CidadeIlustrada className="absolute inset-x-0 bottom-0 w-full" />
          <UrbaninhaMascote humor="acenando" className="absolute bottom-0 left-[106px] h-[106px] w-[94px] drop-shadow-[0_8px_16px_rgb(0_0_0/0.3)]" />
        </div>
      </div>
    </section>
  );
}

function AtalhosCategoria() {
  return (
    <Section title="O que você quer relatar?">
      <div className="-mx-5 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-7 sm:overflow-visible sm:px-0">
        {CATEGORIAS.map((cat, i) => {
          const info = categoriaInfo(cat);
          const Icone = info.icon;
          return (
            <motion.div
              key={cat}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.smooth, delay: staggerDelay(i) }}
              className="snap-start"
            >
              <Link
                href={`/ocorrencias/nova?categoria=${encodeURIComponent(cat)}`}
                className="group flex h-full w-[100px] flex-col items-center gap-2.5 rounded-2xl border border-border bg-surface px-2 py-4 text-center outline-none transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-4 focus-visible:ring-primary/25 sm:w-auto"
                style={{ '--cat': `var(${info.cssVar})` } as CSSProperties}
              >
                <span className="grid size-12 place-items-center rounded-2xl bg-[color-mix(in_oklab,var(--cat)_14%,transparent)] text-[var(--cat)] transition-transform group-hover:scale-110">
                  <Icone className="size-6" aria-hidden />
                </span>
                <span className="text-sm font-medium leading-tight">{info.curta}</span>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </Section>
  );
}

function Metrica({ rotulo, valor, icone: Icone, status, i }: { rotulo: string; valor: number | null; icone: LucideIcon; status?: string; i: number }) {
  const cor = status ? `var(${statusCssVar(status)})` : 'var(--primary)';
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.smooth, delay: staggerDelay(i) }}>
      <Card className="relative h-full overflow-hidden p-4 sm:p-5">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: cor }} />
        <span className="grid size-9 place-items-center rounded-xl" style={{ color: cor, backgroundColor: `color-mix(in oklab, ${cor} 14%, transparent)` }}>
          <Icone className="size-[18px]" aria-hidden />
        </span>
        <div className="tabular mt-3 text-3xl font-semibold tracking-[-.015em]">
          {valor === null ? <Skeleton className="h-9 w-12" /> : <CountUp to={valor} duration={1} />}
        </div>
        <p className="mt-0.5 text-sm text-fg-muted">{rotulo}</p>
      </Card>
    </motion.div>
  );
}

function NaCidade() {
  const { data } = useSWR<StatsCidade>('/api/stats');
  const pct = data && data.total > 0 ? Math.round((data.resolvida / data.total) * 100) : 0;

  return (
    <Card className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg-muted">Em Braço do Norte</p>
        {data ? (
          <p className="mt-1 text-xl font-semibold tracking-[-.01em]">
            <span className="tabular">{data.total}</span> {data.total === 1 ? 'ocorrência registrada' : 'ocorrências registradas'}, <span className="tabular text-[var(--st-resolvida)]">{data.resolvida}</span> {data.resolvida === 1 ? 'resolvida' : 'resolvidas'}
          </p>
        ) : (
          <Skeleton className="mt-2 h-7 w-64" />
        )}
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Ocorrências resolvidas na cidade">
            <motion.div
              className="h-full rounded-full bg-[linear-gradient(90deg,var(--primary),var(--st-resolvida))]"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <span className="tabular text-sm font-semibold">{pct}%</span>
        </div>
        <p className="mt-2 text-sm text-fg-muted">
          {data ? `${data.analise + data.atendimento} em andamento agora` : ' '}
        </p>
      </div>
      <Button asChild variant="secondary" size="lg" className="shrink-0">
        <Link href="/mapa">
          <MapIcon aria-hidden /> Abrir mapa da cidade
        </Link>
      </Button>
    </Card>
  );
}

function SemOcorrencias() {
  return (
    <Card className="flex flex-col items-center px-6 py-10 text-center">
      <UrbaninhaMascote className="h-20 w-[72px]" />
      <h3 className="mt-4 text-lg font-semibold">Você ainda não tem ocorrências</h3>
      <p className="mt-1 max-w-sm text-base text-fg-muted">Quando você registrar um problema, ele aparece aqui para você acompanhar cada etapa.</p>
      <Button asChild className="mt-6">
        <Link href="/ocorrencias/nova">
          <MapPinPlus aria-hidden /> Registrar a primeira
        </Link>
      </Button>
    </Card>
  );
}

export function InicioView() {
  const user = useSession();
  const { data, error, mutate } = useOcorrencias();
  const lista = data ?? null;
  const primeiroNome = user.nome.split(' ')[0] || '';
  const saudacao = primeiroNome ? `${saudacaoPorHorario()}, ${primeiroNome}` : 'Braço do Norte';
  const conta = (status: string) => (lista ? lista.filter((o) => o.status === status).length : null);

  return (
    <Container size="column">
      <Destaque saudacao={saudacao} />

      <AtalhosCategoria />

      <Section title="Seus números">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Metrica i={0} rotulo="Total" valor={lista ? lista.length : null} icone={ClipboardList} />
          <Metrica i={1} rotulo="Em análise" valor={conta('Em análise')} icone={Search} status="Em análise" />
          <Metrica i={2} rotulo="Em atendimento" valor={conta('Em atendimento')} icone={Wrench} status="Em atendimento" />
          <Metrica i={3} rotulo="Resolvidas" valor={conta('Resolvida')} icone={CheckCircle2} status="Resolvida" />
        </div>
      </Section>

      <Section>
        <NaCidade />
      </Section>

      <Section
        title="Suas ocorrências recentes"
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/ocorrencias">
              Ver todas <ArrowRight aria-hidden />
            </Link>
          </Button>
        }
      >
        {error ? (
          <Card>
            <EmptyState icon={ClipboardList} title="Não foi possível carregar" description={error.message} action={<Button variant="secondary" onClick={() => mutate()}>Tentar de novo</Button>} />
          </Card>
        ) : !lista ? (
          <div className="flex flex-col gap-3" aria-hidden>
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)}
          </div>
        ) : lista.length === 0 ? (
          <SemOcorrencias />
        ) : (
          <OcorrenciaLista itens={lista.slice(0, 3)} />
        )}
      </Section>
    </Container>
  );
}
