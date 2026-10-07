'use client';

import { useRouter } from 'next/navigation';
import { useState, type ChangeEvent } from 'react';
import { useSWRConfig } from 'swr';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { resizeImageFile } from '@/lib/image';

/** Troca de foto otimista: mostra a prévia na hora, envia e grava; em erro, volta à foto anterior. */
export function useTrocarFoto() {
  const [previa, setPrevia] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [input, setInput] = useState<HTMLInputElement | null>(null);
  const router = useRouter();
  const { mutate } = useSWRConfig();

  async function aoEscolher(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Escolha um arquivo de imagem.'); return; }
    setEnviando(true);
    try {
      const dataUrl = await resizeImageFile(file, 480, 0.85);
      setPrevia(dataUrl);
      const up = await api<{ url: string }>('POST', '/api/upload', { data: dataUrl });
      await api('PUT', '/api/perfil', { foto: up.url });
      await mutate('/api/perfil');
      router.refresh(); // o avatar do header vem da sessão (Server Component)
      toast.success('Foto atualizada.');
    } catch (err) {
      setPrevia(null);
      toast.error('Não foi possível trocar a foto: ' + (err instanceof Error ? err.message : 'erro desconhecido'));
    } finally {
      setEnviando(false);
    }
  }

  return { previa, enviando, registrarInput: setInput, abrir: () => input?.click(), aoEscolher };
}
