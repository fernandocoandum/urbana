'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/** Copia o protocolo e mostra o "copiado" por 1,6s. */
export function useCopiarProtocolo(protocolo: string) {
  const [copiado, setCopiado] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(protocolo);
      setCopiado(true);
      toast.success('Protocolo copiado!');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopiado(false), 1600);
    } catch {
      toast.error('Não foi possível copiar o protocolo.');
    }
  }
  return { copiado, copiar };
}

/** Chip mono do protocolo: clique copia para a área de transferência. */
export function ProtocoloChip({ protocolo, className }: { protocolo: string; className?: string }) {
  const { copiado, copiar } = useCopiarProtocolo(protocolo);

  return (
    <button
      type="button"
      onClick={copiar}
      title="Clique para copiar"
      aria-label={`Protocolo ${protocolo}. Clique para copiar`}
      className={cn(
        'font-protocol inline-flex h-9 items-center gap-2 rounded-full border border-border bg-surface-2 px-4 text-sm font-medium text-fg outline-none transition-colors hover:border-border-strong hover:bg-border/50 focus-visible:ring-4 focus-visible:ring-primary/25',
        className,
      )}
    >
      {protocolo}
      {copiado ? <Check className="size-4 text-success" aria-hidden /> : <Copy className="size-4 text-fg-muted" aria-hidden />}
    </button>
  );
}
