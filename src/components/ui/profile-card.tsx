'use client';

// Recriado a partir do "freelancer-profile-card" de @lavikatiyar (21st.dev, MIT): banner, avatar
// sobreposto, nome, título, linha de métricas, badges e dois botões. O conteúdo (níveis, conquistas)
// vem de features/perfil.
import { motion } from 'motion/react';
import { Camera, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { CountUp } from '@/components/bits';
import { spring, staggerDelay } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { Avatar } from './avatar';
import { Tip } from './tooltip';

export interface ProfileMetric { valor: number; rotulo: string }
export interface ProfileBadge { icon: LucideIcon; label: string; locked?: boolean; hint?: string }

interface Props {
  nome: string;
  foto?: string | null;
  /** Título abaixo do nome (ex.: ícone do nível + nome do nível). */
  titulo?: ReactNode;
  /** Linha meta: bairro · membro desde… */
  meta?: string;
  metricas?: ProfileMetric[];
  badges?: ProfileBadge[];
  /** Botões (a ação primária única + secundária). */
  acoes?: ReactNode;
  /** Mostra o botão-câmera sobre o avatar. */
  onEditPhoto?: () => void;
  /** `compact`: banner menor, sem ações — usado no perfil público dentro de um Dialog. */
  variant?: 'full' | 'compact';
  className?: string;
  /** id do elemento do nome (E2E de XSS). */
  nomeId?: string;
}

export function ProfileCard({ nome, foto, titulo, meta, metricas, badges, acoes, onEditPhoto, variant = 'full', className, nomeId }: Props) {
  const compact = variant === 'compact';
  const bloco = (i: number) => ({ initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { ...spring.gentle, delay: 0.12 + staggerDelay(i) } });
  const ganhas = badges?.filter((b) => !b.locked).length ?? 0;

  return (
    <div className={cn('overflow-hidden rounded-xl border border-border bg-surface shadow-xs', className)}>
      <motion.div
        aria-hidden
        className={cn('w-full', compact ? 'h-24' : 'h-[140px]')}
        style={{
          backgroundImage: 'radial-gradient(color-mix(in srgb, var(--fg) 6%, transparent) 1px, transparent 1px), linear-gradient(120deg, var(--banner-from), var(--banner-via), var(--banner-to))',
          backgroundSize: '14px 14px, 100% 100%',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      />

      <div
        className={cn(
          'grid gap-x-6 px-6 pb-6 sm:px-8 sm:pb-8',
          // mobile: tudo em coluna, ações por último; ≥sm: ações à direita, na altura do avatar
          "[grid-template-areas:'avatar'_'info'_'metrics'_'badges'_'actions'] sm:grid-cols-[1fr_auto] sm:[grid-template-areas:'avatar_actions'_'info_info'_'metrics_metrics'_'badges_badges']",
        )}
      >
        <motion.div className={cn('relative w-fit [grid-area:avatar]', compact ? '-mt-10' : '-mt-14')} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={spring.smooth}>
          <Avatar nome={nome} foto={foto} size="xl" className={cn('ring-4 ring-surface', compact && 'size-20 text-3xl')} />
          {onEditPhoto && (
            <Tip label="Trocar foto">
              <button
                type="button"
                onClick={onEditPhoto}
                aria-label="Trocar foto do perfil"
                className="absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-full border-2 border-surface bg-primary text-primary-fg shadow-sm outline-none transition-transform hover:scale-105 focus-visible:ring-4 focus-visible:ring-primary/25"
              >
                <Camera className="size-4" />
              </button>
            </Tip>
          )}
        </motion.div>

        {acoes && !compact && (
          <motion.div className="mt-8 flex flex-col gap-3 [grid-area:actions] sm:mt-4 sm:flex-row sm:items-start" {...bloco(3)}>
            {acoes}
          </motion.div>
        )}

        <motion.div className="mt-5 min-w-0 [grid-area:info]" {...bloco(0)}>
          <h2 id={nomeId} data-testid="perfil-nome" className="break-words text-3xl font-[650] tracking-[-.015em] sm:text-4xl">
            {nome}
          </h2>
          {titulo && <div className="mt-2 flex items-center gap-2 text-lg font-medium text-primary [&_svg]:size-5">{titulo}</div>}
          {meta && <p className="mt-2 text-sm text-fg-muted">{meta}</p>}
        </motion.div>

        {metricas && metricas.length > 0 && (
          <motion.dl className="mt-6 grid divide-x divide-border rounded-xl bg-surface-2/60 py-5 [grid-area:metrics]" style={{ gridTemplateColumns: `repeat(${metricas.length}, minmax(0, 1fr))` }} {...bloco(1)}>
            {metricas.map((m) => (
              <div key={m.rotulo} className="flex flex-col-reverse justify-end gap-1 px-2 text-center sm:px-4">
                <dt className="text-sm text-fg-muted">{m.rotulo}</dt>
                <dd className="tabular text-2xl font-semibold leading-8">
                  <CountUp to={m.valor} duration={1.2} />
                </dd>
              </div>
            ))}
          </motion.dl>
        )}

        {badges && badges.length > 0 && (
          <motion.div className="mt-8 [grid-area:badges]" {...bloco(2)}>
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-lg font-semibold">Conquistas</h3>
              <p className="tabular text-sm text-fg-muted">
                {ganhas} de {badges.length}
              </p>
            </div>
            <ul className="mt-4 flex flex-wrap gap-2.5" aria-label="Conquistas">
              {badges.map((b) => {
                const Icon = b.icon;
                const chip = (
                  <li
                    key={b.label}
                    tabIndex={b.locked ? 0 : undefined}
                    className={cn(
                      'inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium outline-none focus-visible:ring-4 focus-visible:ring-primary/25',
                      b.locked ? 'border-border bg-surface text-fg opacity-40' : 'border-primary/20 bg-primary-soft text-primary',
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {b.label}
                    {b.locked && <span className="sr-only"> (bloqueada)</span>}
                  </li>
                );
                return b.locked && b.hint ? (
                  <Tip key={b.label} label={b.hint}>
                    {chip}
                  </Tip>
                ) : (
                  chip
                );
              })}
            </ul>
          </motion.div>
        )}
      </div>
    </div>
  );
}
