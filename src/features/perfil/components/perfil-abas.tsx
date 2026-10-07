'use client';

import { motion } from 'motion/react';
import { ArrowRight, Check, ClipboardList, LogOut, Mail, Sun, Volume2, VolumeX } from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { AnimatedTabs } from '@/components/ui/animated-tabs';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { CategoryIcon } from '@/components/ui/category-icon';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { Switch } from '@/components/ui/switch';
import { useSair } from '@/features/auth/use-sair';
import { fmtDate } from '@/lib/format';
import { spring } from '@/lib/motion';
import { Sound } from '@/lib/sound';
import { cn } from '@/lib/utils';
import { NIVEL_ICONE } from '../icones';
import { NIVEIS, PONTOS, calcularNivel, type PerfilStats } from '../nivel';
import type { PerfilData } from '../types';

const noopSubscribe = () => () => {};
const useMounted = () => useSyncExternalStore(noopSubscribe, () => true, () => false);

/** Atividade: as últimas ocorrências do morador. */
export function AbaAtividade({ recentes }: { recentes: PerfilData['recentes'] }) {
  if (recentes.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={ClipboardList}
          title="Nenhuma ocorrência ainda"
          description="Quando você registrar um problema na rua, ele aparece aqui."
          action={<Button asChild variant="secondary"><Link href="/ocorrencias/nova">Registrar ocorrência</Link></Button>}
        />
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col gap-3">
        {recentes.map((o, i) => (
          <motion.li key={o.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.smooth, delay: i * 0.03 }}>
            <Link
              href={`/ocorrencias/${o.id}`}
              className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 shadow-xs outline-none transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-px hover:border-border-strong hover:shadow-md focus-visible:ring-4 focus-visible:ring-primary/25"
            >
              <CategoryIcon categoria={o.categoria} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-semibold">{o.titulo}</span>
                <span className="tabular mt-0.5 block text-sm text-fg-muted">{fmtDate(o.criadoEm)}</span>
                <StatusBadge status={o.status} className="mt-2 sm:hidden" />
              </span>
              <StatusBadge status={o.status} className="max-sm:hidden" />
            </Link>
          </motion.li>
        ))}
      </ul>
      <div>
        <Button asChild variant="secondary">
          <Link href="/ocorrencias">
            Ver todas <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  );
}

/** Progresso: nível atual e próximo, barra animada, escada de níveis e a tabela de como pontuar. */
export function AbaProgresso({ stats }: { stats: PerfilStats }) {
  const nivel = calcularNivel(stats);
  const Icon = NIVEL_ICONE[nivel.icone];
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
            <Icon className="size-7" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-fg-muted">Seu nível</p>
            <p className="text-xl font-semibold leading-7">{nivel.nome}</p>
          </div>
          <p className="tabular ml-auto shrink-0 text-right">
            <span className="block text-2xl font-semibold leading-8">{nivel.pontos}</span>
            <span className="block text-sm text-fg-muted">pontos</span>
          </p>
        </div>

        <div className="mt-6" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={nivel.progresso} aria-label="Progresso até o próximo nível">
          <div className="h-3 overflow-hidden rounded-full bg-surface-2">
            <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${nivel.progresso}%` }} transition={{ ...spring.gentle, delay: 0.1 }} />
          </div>
          <p className="mt-3 text-sm text-fg-muted">
            {nivel.proximo ? (
              <>
                Faltam <strong className="tabular font-semibold text-fg">{nivel.faltam} pts</strong> para <strong className="font-semibold text-fg">{nivel.proximo}</strong>.
              </>
            ) : (
              'Você chegou ao nível máximo. Obrigado por cuidar da cidade!'
            )}
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader className="mb-2">
          <CardTitle>Níveis</CardTitle>
        </CardHeader>
        <ol>
          {NIVEIS.map((n, i) => {
            const NIcon = NIVEL_ICONE[n.icone];
            const feito = i < nivel.indice;
            const atual = i === nivel.indice;
            return (
              <li key={n.nome} aria-current={atual ? 'step' : undefined} className="flex items-center gap-4 border-b border-border py-4 last:border-b-0 last:pb-0">
                <span className={cn('grid size-10 shrink-0 place-items-center rounded-full', feito || atual ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-fg-subtle')}>
                  {feito ? <Check className="size-5" aria-hidden /> : <NIcon className="size-5" aria-hidden />}
                </span>
                <span className={cn('min-w-0 flex-1 text-base', atual ? 'font-semibold' : feito ? 'font-medium' : 'text-fg-muted')}>
                  {n.nome}
                  {atual && <span className="ml-2 rounded-full bg-primary-soft px-2.5 py-0.5 align-middle text-sm font-medium text-primary">Atual</span>}
                </span>
                <span className="tabular shrink-0 text-sm text-fg-muted">{n.min === 0 ? 'Início' : `${n.min} pts`}</span>
              </li>
            );
          })}
        </ol>
      </Card>

      <Card>
        <CardHeader className="mb-2">
          <CardTitle>Como pontuar</CardTitle>
        </CardHeader>
        <dl>
          {[
            ['Registrar uma ocorrência', PONTOS.ocorrencia],
            ['Ocorrência resolvida', PONTOS.resolvida],
            ['Apoiar a ocorrência de outro morador', PONTOS.apoio],
          ].map(([rotulo, pts]) => (
            <div key={rotulo} className="flex items-center justify-between gap-4 border-b border-border py-4 last:border-b-0 last:pb-0">
              <dt className="text-base">{rotulo}</dt>
              <dd className="tabular shrink-0 text-base font-semibold text-primary">+{pts} pts</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}

const TEMAS = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
  { value: 'system', label: 'Sistema' },
];

function Linha({ icone: Icone, titulo, descricao, children, className }: { icone: React.ComponentType<{ className?: string }>; titulo: string; descricao?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border py-5 first:pt-0 last:border-b-0 last:pb-0', className)}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-fg-muted">
        <Icone className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 basis-40">
        <p className="text-base font-medium">{titulo}</p>
        {descricao && <p className="mt-0.5 break-words text-sm text-fg-muted">{descricao}</p>}
      </div>
      {children}
    </div>
  );
}

/** Conta: e-mail (leitura), tema, som e sair. */
export function AbaConta({ email }: { email: string }) {
  const mounted = useMounted();
  const { theme, setTheme } = useTheme();
  const mudo = useSyncExternalStore(Sound.subscribe, Sound.isMuted, () => false);
  const sair = useSair();
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <Linha icone={Mail} titulo="E-mail" descricao={email}>
          <span className="text-sm text-fg-muted max-sm:hidden">Somente leitura</span>
        </Linha>
        <Linha icone={Sun} titulo="Aparência" descricao="Escolha como o Urbana aparece para você.">
          <div className="max-sm:w-full">
            <AnimatedTabs tabs={TEMAS} value={mounted ? (theme ?? 'system') : 'system'} onValueChange={setTheme} aria-label="Tema" fullWidth />
          </div>
        </Linha>
        <Linha icone={mudo ? VolumeX : Volume2} titulo="Sons" descricao="Avisos sonoros ao enviar e receber mensagens.">
          <Switch checked={!mudo} onCheckedChange={() => Sound.toggle()} aria-label="Sons do aplicativo" />
        </Linha>
      </Card>
      <div>
        <Button variant="secondary" onClick={sair} className="text-danger">
          <LogOut aria-hidden /> Sair da conta
        </Button>
      </div>
    </div>
  );
}
