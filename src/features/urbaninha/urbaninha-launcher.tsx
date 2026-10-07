'use client';

import { MessageCircleQuestion, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import { Tip } from '@/components/ui/tooltip';

// O painel (e as regras) só é baixado no primeiro clique.
const Painel = dynamic(() => import('./urbaninha-panel'), { ssr: false });

/** Botão flutuante da Urbaninha, acima da barra inferior no mobile. */
export function UrbaninhaLauncher() {
  const [aberto, setAberto] = useState(false);
  const [jaAbriu, setJaAbriu] = useState(false);
  const fechar = useCallback(() => setAberto(false), []);

  return (
    <>
      <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom)+16px)] right-4 z-40 md:bottom-6 md:right-6">
        <Tip label={aberto ? 'Fechar a Urbaninha' : 'Falar com a Urbaninha'} side="left">
          <button
            type="button"
            aria-label={aberto ? 'Fechar assistente de suporte Urbaninha' : 'Abrir assistente de suporte Urbaninha'}
            aria-expanded={aberto}
            onClick={() => { setJaAbriu(true); setAberto((a) => !a); }}
            className="grid size-14 place-items-center rounded-full border border-border bg-surface text-primary shadow-lg outline-none transition-[transform,box-shadow] hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-primary/30 active:scale-95"
          >
            {aberto ? <X className="size-6" aria-hidden /> : <MessageCircleQuestion className="size-6" aria-hidden />}
          </button>
        </Tip>
      </div>
      {jaAbriu && <Painel aberto={aberto} onClose={fechar} />}
    </>
  );
}
