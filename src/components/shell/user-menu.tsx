'use client';

import { LogOut, Moon, Sun, UserRound, Volume2, VolumeX } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { useSession } from '@/features/auth/session-context';
import { useSair } from '@/features/auth/use-sair';
import { Sound } from '@/lib/sound';

const noopSubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/** Menu do usuário: Meu perfil, Tema claro/escuro, Som on/off, Sair. */
export function UserMenu() {
  const user = useSession();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const mudo = useSyncExternalStore(Sound.subscribe, Sound.isMuted, () => false);
  const escuro = mounted && resolvedTheme === 'dark';

  const sair = useSair();

  return (
    <Menu>
      <MenuTrigger asChild>
        <button type="button" aria-label="Menu do usuário" className="grid size-11 place-items-center rounded-full outline-none transition-shadow hover:ring-4 hover:ring-primary/10 focus-visible:ring-4 focus-visible:ring-primary/25 data-[state=open]:ring-4 data-[state=open]:ring-primary/15">
          <Avatar nome={user.nome} foto={user.foto} size="md" />
        </button>
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>
          <p className="truncate text-base font-semibold">{user.nome}</p>
          <p className="truncate text-sm text-fg-muted">{user.email}</p>
        </MenuLabel>
        <MenuSeparator />
        <MenuItem icon={UserRound} onSelect={() => router.push('/perfil')}>
          Meu perfil
        </MenuItem>
        <MenuItem icon={escuro ? Sun : Moon} keepOpen onSelect={() => setTheme(escuro ? 'light' : 'dark')}>
          {escuro ? 'Tema claro' : 'Tema escuro'}
        </MenuItem>
        <MenuItem icon={mudo ? VolumeX : Volume2} keepOpen onSelect={() => Sound.toggle()}>
          {mudo ? 'Ativar sons' : 'Desativar sons'}
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={LogOut} danger onSelect={sair}>
          Sair
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
