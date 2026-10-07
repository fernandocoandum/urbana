'use client';

import { ArrowRight, ClipboardList, MapPinPlus } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BlurText, CountUp } from '@/components/bits';
import { Container, Section } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { statusCssVar } from '@/features/ocorrencias/categorias';
import { useSession } from '@/features/auth/session-context';
import { dataDeHojeExtenso, saudacaoPorHorario } from '@/lib/format';
import { useOcorrencias } from '../hooks';
import { OcorrenciaLista } from './ocorrencia-lista';

const SAUDACAO_KEY = 'urbana:saudacao-animada';
const TITULO = 'text-4xl font-[650] tracking-[-.02em]';

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

  if (animar) return <BlurText as="h1" text={texto} delay={140} className={TITULO} />;
  // enquanto decide (SSR/hidratação), o título já ocupa o espaço, invisível, para não saltar o layout
  return (
    <h1 className={TITULO} style={{ opacity: animar === null ? 0 : 1 }}>
      {texto}
    </h1>
  );
}

function Metrica({ rotulo, valor, status }: { rotulo: string; valor: number | null; status?: string }) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="flex items-center gap-2 text-sm text-fg-muted">
        {status && <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: `var(${statusCssVar(status)})` }} />}
        {rotulo}
      </p>
      <div className="tabular mt-2 text-3xl font-semibold tracking-[-.015em]">
        {valor === null ? <Skeleton className="h-9 w-12" /> : <CountUp to={valor} duration={1} />}
      </div>
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
      <header>
        <Saudacao texto={saudacao} />
        <p className="mt-2 text-base text-fg-muted" suppressHydrationWarning>
          {dataDeHojeExtenso()}
        </p>
      </header>

      <Section>
        <Card className="flex flex-col gap-5 bg-gradient-to-br from-primary-soft to-surface sm:flex-row sm:items-center sm:gap-6 sm:p-8">
          <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-surface text-primary shadow-sm">
            <MapPinPlus className="size-8" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold">Viu um problema na rua?</h2>
            <p className="mt-1 text-base text-fg-muted">Registre em menos de um minuto</p>
          </div>
          <Button asChild size="lg">
            <Link href="/ocorrencias/nova">Registrar ocorrência</Link>
          </Button>
        </Card>
      </Section>

      <Section>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Metrica rotulo="Total" valor={lista ? lista.length : null} />
          <Metrica rotulo="Em análise" valor={conta('Em análise')} status="Em análise" />
          <Metrica rotulo="Em atendimento" valor={conta('Em atendimento')} status="Em atendimento" />
          <Metrica rotulo="Resolvidas" valor={conta('Resolvida')} status="Resolvida" />
        </div>
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
          <Card>
            <EmptyState icon={ClipboardList} title="Você ainda não tem ocorrências" description="Quando você registrar um problema, ele aparece aqui para você acompanhar." />
          </Card>
        ) : (
          <OcorrenciaLista itens={lista.slice(0, 3)} />
        )}
      </Section>
    </Container>
  );
}
