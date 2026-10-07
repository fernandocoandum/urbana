'use client';

import { MapPinned } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/ui/category-icon';
import type { Passo, WizardState } from './state';

function Linha({ rotulo, passo, onEditar, children }: { rotulo: string; passo: Passo; onEditar: (p: Passo) => void; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm text-fg-muted">{rotulo}</p>
        <div className="mt-1 break-words text-base">{children}</div>
      </div>
      <Button variant="ghost" size="sm" className="-mr-2 shrink-0" onClick={() => onEditar(passo)} aria-label={`Editar ${rotulo.toLowerCase()}`}>
        Editar
      </Button>
    </div>
  );
}

/** Passo 4: tudo o que será enviado, com "Editar" por bloco. */
export function StepRevisao({ s, onEditar }: { s: WizardState; onEditar: (passo: Passo) => void }) {
  return (
    <div id="wz-review" className="divide-y divide-border rounded-xl border border-border bg-surface p-5 shadow-xs sm:p-6">
      <Linha rotulo="Categoria" passo={1} onEditar={onEditar}>
        <span className="inline-flex items-center gap-3 font-medium">
          <CategoryIcon categoria={s.categoria} size="sm" />
          {s.categoria}
        </span>
      </Linha>
      <Linha rotulo="Local" passo={2} onEditar={onEditar}>
        {s.bairro} — {s.endereco.trim()}
        {s.referencia.trim() ? ` (${s.referencia.trim()})` : ''}
        {s.lat !== null && (
          <span className="mt-1 flex items-center gap-1.5 text-sm text-fg-muted">
            <MapPinned className="size-4" aria-hidden />
            {s.precisao === 'gps' ? 'Ponto marcado pelo GPS' : 'Ponto marcado no mapa'}
          </span>
        )}
      </Linha>
      <Linha rotulo="Título" passo={3} onEditar={onEditar}>
        <span className="font-medium">{s.titulo.trim()}</span>
        {s.descricao.trim() && <span className="mt-1 block whitespace-pre-line text-sm text-fg-muted">{s.descricao.trim()}</span>}
      </Linha>
      {s.fotoUrl && (
        <Linha rotulo="Foto" passo={3} onEditar={onEditar}>
          <img src={s.fotoUrl} alt="Foto que será enviada" className="mt-2 aspect-video w-full max-w-sm rounded-xl border border-border object-cover" />
        </Linha>
      )}
    </div>
  );
}
