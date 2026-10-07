'use client';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ProfileCard } from '@/components/ui/profile-card';
import useSWR from 'swr';
import { calcularConquistas } from '../conquistas';
import { CONQUISTA_ICONE, NIVEL_ICONE } from '../icones';
import { calcularNivel } from '../nivel';
import type { PerfilPublicoData } from '../types';

/** Perfil público (`/api/usuarios/:id/perfil`): o mesmo ProfileCard na variante compacta, sem ações. */
export function PerfilPublicoDialog({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  return (
    <Dialog open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Perfil do morador" bare className="max-w-[520px]">
        {userId && <Conteudo userId={userId} />}
      </DialogContent>
    </Dialog>
  );
}

function Conteudo({ userId }: { userId: string }) {
  const { data, error } = useSWR<PerfilPublicoData>(`/api/usuarios/${encodeURIComponent(userId)}/perfil`);
  if (error) return <p role="alert" className="p-8 text-base text-fg-muted">Não foi possível carregar este perfil. {error.message}</p>;
  if (!data) {
    return (
      <div aria-busy="true">
        <Skeleton className="h-24 rounded-none" />
        <div className="px-6 pb-8 sm:px-8">
          <Skeleton className="-mt-10 size-20 rounded-full ring-4 ring-surface" />
          <Skeleton className="mt-5 h-8 w-48" />
          <Skeleton className="mt-3 h-6 w-40" />
          <Skeleton className="mt-6 h-24" />
        </div>
      </div>
    );
  }
  const nivel = calcularNivel(data.stats);
  const NivelIcon = NIVEL_ICONE[nivel.icone];
  const conquistas = calcularConquistas(data.stats).map((c) => ({ icon: CONQUISTA_ICONE[c.icone], label: c.label, locked: !c.conquistada, hint: c.dica }));
  return (
    <ProfileCard
      variant="compact"
      className="rounded-none border-0 shadow-none"
      nome={data.nome}
      foto={data.foto}
      titulo={<><NivelIcon aria-hidden /> {nivel.nome}</>}
      metricas={[
        { valor: data.stats.ocorrencias, rotulo: 'Ocorrências' },
        { valor: data.stats.resolvidas, rotulo: 'Resolvidas' },
        { valor: data.stats.apoiosDados, rotulo: 'Apoios dados' },
      ]}
      badges={conquistas}
    />
  );
}
