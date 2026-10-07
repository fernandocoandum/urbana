'use client';

// Recriado a partir do "freelancer-profile-card" de @lavikatiyar (21st.dev, MIT): banner, avatar
// sobreposto, nome, título, linha de métricas, badges e dois botões. O conteúdo real do perfil
// (conquistas, níveis) entra na Etapa E; aqui fica o componente genérico.
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

      <div className="px-6 pb-6 sm:px-8 sm:pb-8">
        <motion.div className={cn('relative w-fit', compact ? '-mt-10' : '-mt-14')} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={spring.smooth}>
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

        <motion.div className="mt-4" {...bloco(0)}>
          <h2 id={nomeId} data-testid="perfil-nome" className="break-words text-4xl font-[650] tracking-[-.015em]">
            {nome}
          </h2>
          {titulo && <div className="mt-1 flex items-center gap-2 text-lg font-medium text-primary">{titulo}</div>}
          {meta && <p className="mt-2 text-sm text-fg-muted">{meta}</p>}
        </motion.div>

        {metricas && metricas.length > 0 && (
          <motion.dl className="mt-6 grid divide-x divide-border rounded-xl bg-surface-2/60 py-4" style={{ gridTemplateColumns: `repeat(${metricas.length}, minmax(0, 1fr))` }} {...bloco(1)}>
            {metricas.map((m) => (
              <div key={m.rotulo} className="px-3 text-center">
                <dd className="tabular text-2xl font-semibold">
                  <CountUp to={m.valor} duration={1.2} />
                </dd>
                <dt className="mt-0.5 text-sm text-fg-muted">{m.rotulo}</dt>
              </div>
            ))}
          </motion.dl>
        )}

        {badges && badges.length > 0 && (
          <motion.ul className="mt-6 flex flex-wrap gap-2" aria-label="Conquistas" {...bloco(2)}>
            {badges.map((b) => {
              const Icon = b.icon;
              const chip = (
                <li
                  key={b.label}
                  tabIndex={b.locked ? 0 : undefined}
                  className={cn('inline-flex h-9 items-center gap-2 rounded-full border border-border bg-surface px-3.5 text-sm font-medium', b.locked && 'opacity-40')}
                >
                  <Icon className="size-4 text-primary" aria-hidden />
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
          </motion.ul>
        )}

        {acoes && !compact && (
          <motion.div className="mt-8 flex flex-col gap-3 sm:flex-row" {...bloco(3)}>
            {acoes}
          </motion.div>
        )}
      </div>
    </div>
  );
}
