'use client';

import { Pencil, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { Container } from '@/components/layout/page';
import { AnimatedTabs, AnimatedTabsPanel } from '@/components/ui/animated-tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProfileCard } from '@/components/ui/profile-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/features/auth/session-context';
import { fmtMesAno } from '@/lib/format';
import { calcularConquistas } from '../conquistas';
import { CONQUISTA_ICONE, NIVEL_ICONE } from '../icones';
import { calcularNivel } from '../nivel';
import type { PerfilData } from '../types';
import { AbaAtividade, AbaConta, AbaProgresso } from './perfil-abas';
import { EditarPerfilDialog } from './editar-perfil-dialog';
import { useTrocarFoto } from './use-trocar-foto';

const ABAS = [
  { value: 'atividade', label: 'Atividade', id: 'perfil-tab-atividade' },
  { value: 'progresso', label: 'Progresso', id: 'perfil-tab-progresso' },
  { value: 'conta', label: 'Conta', id: 'perfil-tab-conta' },
];

interface StatsAdmin { total: number; resolvida: number }

export function PerfilView() {
  const sessao = useSession();
  const admin = sessao.role === 'admin';
  const { data: perfil, error } = useSWR<PerfilData>('/api/perfil');
  const { data: statsAdmin } = useSWR<StatsAdmin>(admin ? '/api/stats' : null);
  const [aba, setAba] = useState('atividade');
  const [editando, setEditando] = useState(false);
  const { previa, registrarInput, abrir: abrirFoto, aoEscolher } = useTrocarFoto();

  if (error) {
    return (
      <Container size="column">
        <Card>
          <p role="alert" className="text-base text-fg-muted">Não foi possível carregar o perfil. {error.message}</p>
        </Card>
      </Container>
    );
  }

  if (!perfil) {
    return (
      <Container size="column">
        <div aria-busy="true" className="overflow-hidden rounded-xl border border-border bg-surface">
          <Skeleton className="h-[140px] rounded-none" />
          <div className="px-6 pb-8 sm:px-8">
            <Skeleton className="-mt-14 size-28 rounded-full ring-4 ring-surface" />
            <Skeleton className="mt-5 h-10 w-64 max-w-full" />
            <Skeleton className="mt-3 h-6 w-48" />
            <Skeleton className="mt-6 h-24" />
          </div>
        </div>
      </Container>
    );
  }

  const nivel = calcularNivel(perfil.stats);
  const NivelIcon = NIVEL_ICONE[nivel.icone];
  const desde = fmtMesAno(perfil.criadoEm);
  const meta = [perfil.bairro, desde && `Membro desde ${desde}`].filter(Boolean).join(' · ');
  const metricas = admin
    ? [
        { valor: statsAdmin?.total ?? 0, rotulo: 'Total' },
        { valor: statsAdmin?.resolvida ?? 0, rotulo: 'Resolvidas' },
        { valor: statsAdmin ? statsAdmin.total - statsAdmin.resolvida : 0, rotulo: 'Em aberto' },
      ]
    : [
        { valor: perfil.stats.ocorrencias, rotulo: 'Ocorrências' },
        { valor: perfil.stats.resolvidas, rotulo: 'Resolvidas' },
        { valor: perfil.stats.apoiosDados, rotulo: 'Apoios dados' },
      ];
  const conquistas = admin ? undefined : calcularConquistas(perfil.stats).map((c) => ({ icon: CONQUISTA_ICONE[c.icone], label: c.label, locked: !c.conquistada, hint: c.dica }));

  return (
    <Container size="column">
      <h1 className="sr-only">Meu perfil</h1>
      {/* a métrica do admin só anima quando os números chegam: a key refaz a contagem */}
      <ProfileCard
        key={admin ? String(!!statsAdmin) : 'morador'}
        nomeId="perfil-nome-display"
        nome={perfil.nome}
        foto={previa ?? perfil.foto}
        onEditPhoto={abrirFoto}
        titulo={admin ? 'Equipe da Prefeitura' : <><NivelIcon aria-hidden /> {nivel.nome}</>}
        meta={meta}
        metricas={metricas}
        badges={conquistas}
        acoes={
          <>
            {!admin && (
              <Button asChild>
                <Link href="/ocorrencias/nova">
                  <Plus aria-hidden /> Nova ocorrência
                </Link>
              </Button>
            )}
            <Button variant={admin ? 'primary' : 'secondary'} onClick={() => setEditando(true)}>
              <Pencil aria-hidden /> Editar perfil
            </Button>
          </>
        }
      />
      <input ref={registrarInput} type="file" accept="image/*" className="hidden" onChange={aoEscolher} aria-label="Escolher foto do perfil" />

      <div className="mt-10">
        {admin ? (
          <AbaConta email={perfil.email} />
        ) : (
          <AnimatedTabs tabs={ABAS} value={aba} onValueChange={setAba} variant="underline" aria-label="Seções do perfil">
            <AnimatedTabsPanel value="atividade" labelledBy="perfil-tab-atividade" className="mt-6">
              <AbaAtividade recentes={perfil.recentes} />
            </AnimatedTabsPanel>
            <AnimatedTabsPanel value="progresso" labelledBy="perfil-tab-progresso" className="mt-6">
              <AbaProgresso stats={perfil.stats} />
            </AnimatedTabsPanel>
            <AnimatedTabsPanel value="conta" labelledBy="perfil-tab-conta" className="mt-6">
              <AbaConta email={perfil.email} />
            </AnimatedTabsPanel>
          </AnimatedTabs>
        )}
      </div>

      <EditarPerfilDialog open={editando} onOpenChange={setEditando} nome={perfil.nome} bairro={perfil.bairro} foto={previa ?? perfil.foto} onTrocarFoto={abrirFoto} />
    </Container>
  );
}
