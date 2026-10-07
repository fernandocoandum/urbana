'use client';

import { motion } from 'motion/react';
import { ClipboardList, LayoutDashboard, Map as MapIcon, Menu as MenuIcon, MessagesSquare, PanelLeftClose, PanelLeftOpen, Search, UserRound, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Tip } from '@/components/ui/tooltip';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { Brand } from './brand';
import { UserMenu } from './user-menu';

interface NavItem { href: string; label: string; icon: LucideIcon; exact?: boolean; badge?: boolean }
const NAV: NavItem[] = [
  { href: '/admin', label: 'Visão geral', icon: LayoutDashboard, exact: true },
  { href: '/admin/ocorrencias', label: 'Ocorrências', icon: ClipboardList, badge: true },
  { href: '/admin/mapa', label: 'Mapa', icon: MapIcon },
  { href: '/conversa', label: 'Conversa', icon: MessagesSquare },
  { href: '/perfil', label: 'Perfil', icon: UserRound },
];

function tituloDa(pathname: string): string {
  if (pathname === '/admin') return 'Visão geral';
  if (pathname.startsWith('/admin/ocorrencias/')) return 'Ocorrência';
  if (pathname.startsWith('/admin/ocorrencias')) return 'Ocorrências';
  if (pathname.startsWith('/admin/mapa')) return 'Mapa';
  if (pathname.startsWith('/conversa')) return 'Conversa da cidade';
  if (pathname.startsWith('/perfil')) return 'Perfil';
  return 'Painel';
}

function ativo(item: NavItem, pathname: string) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/');
}

function NavLinks({ collapsed, naoLidas, onNavigate }: { collapsed: boolean; naoLidas: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegação do painel" className="flex flex-col gap-1">
      {NAV.map((item) => {
        const on = ativo(item, pathname);
        const Icon = item.icon;
        const link = (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={on ? 'page' : undefined}
            aria-label={collapsed ? item.label : undefined}
            className={cn(
              'relative flex h-11 items-center gap-3 rounded-lg text-base font-medium outline-none transition-colors focus-visible:ring-4 focus-visible:ring-primary/25',
              collapsed ? 'justify-center px-0' : 'px-3',
              on ? 'bg-primary-soft text-primary' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
            {item.badge && naoLidas > 0 && (
              <span
                className={cn('tabular grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1.5 text-caption font-medium text-primary-fg', collapsed && 'absolute right-1.5 top-1.5 h-4 min-w-4 px-1')}
                aria-label={`${naoLidas} não lidas`}
              >
                {naoLidas}
              </span>
            )}
          </Link>
        );
        return collapsed ? (
          <Tip key={item.href} label={item.label} side="right">
            {link}
          </Tip>
        ) : (
          link
        );
      })}
    </nav>
  );
}

/** Shell do admin: sidebar de 248px recolhível para 72px (Sheet no mobile) + header com busca por protocolo. */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const { data: stats } = useSWR<{ naoLidas?: number }>('/api/stats', { refreshInterval: 20000 });
  const naoLidas = stats?.naoLidas ?? 0;

  function buscar(e: FormEvent) {
    e.preventDefault();
    const q = busca.trim();
    router.push(q ? `/admin/ocorrencias?busca=${encodeURIComponent(q)}` : '/admin/ocorrencias');
  }

  return (
    <div className="flex min-h-dvh">
      <a href="#conteudo" className="sr-only z-[70] rounded-md bg-surface px-4 py-2 font-medium focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Pular para o conteúdo
      </a>

      <motion.aside
        className="sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface lg:flex"
        initial={false}
        animate={{ width: collapsed ? 72 : 248 }}
        transition={spring.smooth}
      >
        <div className={cn('flex h-16 items-center border-b border-border', collapsed ? 'justify-center' : 'px-5')}>
          <Brand href="/admin" showText={!collapsed} />
        </div>
        <div className={cn('flex-1 overflow-y-auto py-4', collapsed ? 'px-3' : 'px-3')}>
          <NavLinks collapsed={collapsed} naoLidas={naoLidas} />
        </div>
        <div className={cn('border-t border-border p-3', collapsed && 'flex justify-center')}>
          <Tip label={collapsed ? 'Expandir menu' : 'Recolher menu'} side="right">
            <Button variant="ghost" size={collapsed ? 'icon' : 'md'} onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'} className={cn(!collapsed && 'w-full justify-start')}>
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
              {!collapsed && 'Recolher'}
            </Button>
          </Tip>
        </div>
      </motion.aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 h-16 border-b border-border bg-surface/80 backdrop-blur">
          <div className="flex h-full items-center gap-3 px-5 sm:px-8 lg:px-10">
            <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="-ml-2 lg:hidden" aria-label="Abrir menu">
                  <MenuIcon />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" title="Menu do painel" hideTitle>
                <div className="-mx-2 -mt-1 mb-6 pl-2">
                  <Brand href="/admin" />
                </div>
                <NavLinks collapsed={false} naoLidas={naoLidas} onNavigate={() => setMenuAberto(false)} />
              </SheetContent>
            </Sheet>

            <p className="min-w-0 flex-1 truncate text-lg font-semibold">{tituloDa(pathname)}</p>

            <form onSubmit={buscar} role="search" className="relative hidden w-72 sm:block">
              <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                aria-label="Buscar por protocolo"
                placeholder="Buscar por protocolo"
                className="h-10 w-full rounded-full border-2 border-border bg-surface pl-10 pr-4 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-fg-subtle hover:border-border-strong focus:border-primary focus:ring-4 focus:ring-primary/15"
              />
            </form>
            <UserMenu />
          </div>
        </header>
        <main id="conteudo" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
