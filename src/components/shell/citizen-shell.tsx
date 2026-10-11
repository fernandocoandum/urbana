'use client';

import { ClipboardList, Home, Map as MapIcon, MessagesSquare, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ExpandableTabs, type ExpandableItem } from '@/components/ui/expandable-tabs';
import { Tip } from '@/components/ui/tooltip';
import { UrbaninhaLauncher } from '@/features/urbaninha/urbaninha-launcher';
import { cn } from '@/lib/utils';
import { Brand } from './brand';
import { NotificationBell } from './notification-bell';
import { UserMenu } from './user-menu';

const NAV = {
  inicio: { title: 'Início', icon: Home, href: '/inicio' },
  ocorrencias: { title: 'Ocorrências', icon: ClipboardList, href: '/ocorrencias' },
  mapa: { title: 'Mapa', icon: MapIcon, href: '/mapa' },
  conversa: { title: 'Conversa', icon: MessagesSquare, href: '/conversa' },
} as const;

const desktopTabs: ExpandableItem[] = [NAV.inicio, NAV.ocorrencias, NAV.mapa, NAV.conversa];

const mobileTabs: ExpandableItem[] = [
  NAV.inicio,
  NAV.ocorrencias,
  {
    type: 'custom',
    node: (
      <Tip label="Nova ocorrência" side="top">
        <Link
          href="/ocorrencias/nova"
          aria-label="Nova ocorrência"
          className="mx-1 grid size-14 -translate-y-2 place-items-center rounded-full bg-primary text-primary-fg shadow-lg outline-none transition-transform active:scale-95 focus-visible:ring-4 focus-visible:ring-primary/30"
        >
          <Plus className="size-7" aria-hidden />
        </Link>
      </Tip>
    ),
  },
  NAV.mapa,
  NAV.conversa,
];

/** Shell do cidadão: header sticky de 64px + navegação (topo no desktop, barra inferior no mobile). */
export function CitizenShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Uma ação primária por tela: no Início o CTA do próprio conteúdo é a ação; no wizard é o "Próximo".
  const semBotaoNova = pathname === '/inicio' || pathname === '/ocorrencias/nova' || pathname === '/perfil';
  // O wizard é uma tela de foco: sem barra inferior (a barra de ações dele fica no rodapé) e sem Urbaninha.
  const foco = pathname === '/ocorrencias/nova';
  // A conversa e o mapa ocupam a altura toda (o compositor fica logo acima da barra inferior): sem respiro extra nem Urbaninha por cima.
  const altura = pathname === '/conversa' || pathname === '/mapa';
  return (
    <div className="min-h-dvh">
      <a href="#conteudo" className="sr-only z-[70] rounded-md bg-surface px-4 py-2 font-medium focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Pular para o conteúdo
      </a>

      <header className="sticky top-0 z-40 h-16 border-b border-border bg-surface/80 backdrop-blur app:bg-surface">
        <div className="mx-auto grid h-full max-w-[1120px] grid-cols-[1fr_auto] items-center gap-4 px-5 sm:px-8 md:grid-cols-[1fr_auto_1fr] lg:px-10">
          <Brand />
          <ExpandableTabs mode="nav" tabs={desktopTabs} aria-label="Navegação principal" className="hidden md:flex" />
          <div className="flex items-center justify-end gap-1">
            <Button asChild className={cn('mr-2 hidden max-lg:size-11 max-lg:px-0 md:inline-flex', semBotaoNova && 'md:hidden')}>
              <Link href="/ocorrencias/nova" aria-label="Nova ocorrência">
                <Plus aria-hidden />
                <span className="max-lg:sr-only">Nova ocorrência</span>
              </Link>
            </Button>
            <NotificationBell />
            <UserMenu />
          </div>
        </div>
      </header>

      <main id="conteudo" className={cn(!foco && !altura && 'pb-[calc(72px+env(safe-area-inset-bottom)+1.5rem)] md:pb-0', altura && 'pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-0')}>
        {children}
      </main>

      {!foco && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 pb-safe backdrop-blur app:bg-surface md:hidden">
          <div className="flex h-[72px] items-center px-3">
            <ExpandableTabs mode="nav" tabs={mobileTabs} aria-label="Navegação principal" className="w-full justify-between border-0 bg-transparent p-0 shadow-none" />
          </div>
        </div>
      )}
      {!foco && !altura && <UrbaninhaLauncher />}
    </div>
  );
}
