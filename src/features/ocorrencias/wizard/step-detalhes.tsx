'use client';

import { ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Acao, WizardState } from './state';

/** Passo 3: título, descrição, ponto de referência e foto (com arrastar e soltar). */
export function StepDetalhes({ s, dispatch, onFoto }: { s: WizardState; dispatch: (a: Acao) => void; onFoto: (file: File | null) => void }) {
  const faltaTitulo = s.tentou && !s.titulo.trim();
  return (
    <div className="flex flex-col gap-6">
      <Field label="Título" htmlFor="f-titulo" error={faltaTitulo ? 'Dê um título curto para a ocorrência.' : null}>
        <Input id="f-titulo" placeholder="Descreva brevemente o problema" maxLength={150} aria-invalid={faltaTitulo || undefined} value={s.titulo} onChange={(e) => dispatch({ type: 'campo', campo: 'titulo', valor: e.target.value })} />
      </Field>
      <Field label="Descrição detalhada" htmlFor="f-descricao" optional>
        <Textarea id="f-descricao" placeholder="Tamanho, localização exata, há quanto tempo existe, riscos..." maxLength={3000} value={s.descricao} onChange={(e) => dispatch({ type: 'campo', campo: 'descricao', valor: e.target.value })} />
      </Field>
      <Field label="Ponto de referência" htmlFor="f-referencia" optional>
        <Input id="f-referencia" placeholder="Em frente ao mercado, próximo à escola..." maxLength={200} value={s.referencia} onChange={(e) => dispatch({ type: 'campo', campo: 'referencia', valor: e.target.value })} />
      </Field>
      <FotoDropzone s={s} onFoto={onFoto} />
    </div>
  );
}

function FotoDropzone({ s, onFoto }: { s: WizardState; onFoto: (file: File | null) => void }) {
  const [arrastando, setArrastando] = useState(false);

  function receber(file: File | undefined | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Selecione um arquivo de imagem.'); return; }
    onFoto(file);
  }
  function soltar(e: DragEvent) {
    e.preventDefault();
    setArrastando(false);
    receber(e.dataTransfer.files?.[0]);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">
        Foto do problema <span className="font-normal text-fg-muted">(opcional)</span>
      </span>
      {s.fotoUrl ? (
        <div className="flex flex-col gap-3">
          <img src={s.fotoUrl} alt="Prévia da foto escolhida" className="aspect-video w-full rounded-xl border border-border object-cover" />
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="sm">
              <label htmlFor="f-foto" className="cursor-pointer">
                <RefreshCw aria-hidden /> Trocar foto
              </label>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onFoto(null)}>
              <Trash2 aria-hidden /> Remover
            </Button>
          </div>
        </div>
      ) : (
        <label
          htmlFor="f-foto"
          onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
          onDragLeave={() => setArrastando(false)}
          onDrop={soltar}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-150 focus-within:ring-4 focus-within:ring-primary/25 hover:border-primary hover:bg-primary-soft',
            arrastando ? 'border-primary bg-primary-soft' : 'border-border-strong bg-surface',
          )}
        >
          <span className="grid size-12 place-items-center rounded-full bg-primary-soft text-primary">
            <ImagePlus className="size-6" aria-hidden />
          </span>
          <span className="text-base font-medium">Clique ou arraste uma foto aqui</span>
          <span className="text-sm text-fg-muted">JPG, PNG ou WEBP. Reduzimos o tamanho automaticamente.</span>
        </label>
      )}
      <input id="f-foto" type="file" accept="image/*" className="sr-only" onChange={(e) => { receber(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}
