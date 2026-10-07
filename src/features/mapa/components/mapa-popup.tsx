'use client';

import { Check, MapPin } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { categoriaInfo } from '@/features/ocorrencias/categorias';
import type { PontoMapa } from '../mapa-utils';

export interface MapaPopupProps {
  ponto: PontoMapa;
  aproximado: boolean;
  admin: boolean;
  onVerDetalhes: (id: string) => void;
  /** Alterna o apoio e devolve o estado novo (a API é a fonte da verdade). */
  onApoiar: (id: string) => Promise<{ apoiado: boolean; total: number } | null>;
  /** Avisa o Leaflet que a altura do conteúdo mudou. */
  onResize: () => void;
}

/** Conteúdo do popup do ponto: montado num nó DOM via createRoot (nunca HTML em string). */
export function MapaPopup({ ponto: p, aproximado, admin, onVerDetalhes, onApoiar, onResize }: MapaPopupProps) {
  const info = categoriaInfo(p.categoria);
  const Icon = info.icon;
  const [apoiado, setApoiado] = useState(p.apoiado);
  const [total, setTotal] = useState(p.apoios);
  const [enviando, setEnviando] = useState(false);
  const dono = p.isMine || admin;

  async function apoiar() {
    setEnviando(true);
    try {
      const r = await onApoiar(p.id);
      if (r) {
        setApoiado(r.apoiado);
        setTotal(r.total);
        requestAnimationFrame(onResize);
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="w-[248px] max-w-full">
      <p className="flex items-center gap-1.5 text-sm font-medium" style={{ color: `var(${info.cssVar})` }}>
        <Icon className="size-4" aria-hidden /> {p.categoria}
      </p>
      <h3 className="mt-1 break-words text-base font-semibold leading-snug">{p.titulo}</h3>
      <p className="mt-1 break-words text-sm leading-5 text-fg-muted">
        {admin && p.nomeUsuario ? `${p.nomeUsuario} · ` : ''}
        {p.bairro} · <span className="font-protocol">{p.protocolo}</span>
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <StatusBadge status={p.status} />
        <span className="tabular text-sm text-fg-muted">
          {total} apoio{total === 1 ? '' : 's'}
        </span>
      </div>
      {admin && p.atrasada && (
        <p className="mt-2.5 text-sm font-medium leading-5 text-danger">
          Atrasada{typeof p.diasAberto === 'number' ? ` · ${p.diasAberto} ${p.diasAberto === 1 ? 'dia' : 'dias'} em aberto` : ''}
        </p>
      )}
      {aproximado && (
        <p className="mt-2.5 flex items-center gap-1.5 text-sm leading-5 text-fg-muted">
          <MapPin className="size-4 shrink-0" aria-hidden /> Localização aproximada
        </p>
      )}
      <div className="mt-3.5">
        {dono ? (
          <Button size="sm" className="w-full" onClick={() => onVerDetalhes(p.id)}>
            {admin ? 'Abrir na fila' : 'Ver detalhes'}
          </Button>
        ) : (
          <Button size="sm" variant={apoiado ? 'secondary' : 'primary'} className="w-full" loading={enviando} aria-pressed={apoiado} onClick={apoiar}>
            {apoiado ? <><Check aria-hidden /> Você apoia</> : 'Eu também tenho esse problema'}
          </Button>
        )}
      </div>
    </div>
  );
}
