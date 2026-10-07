'use client';

import { Camera } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useSWRConfig } from 'swr';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/input';
import { BAIRROS } from '@/features/ocorrencias/categorias';
import { api, ApiError } from '@/lib/api-client';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  nome: string;
  bairro: string;
  foto: string | null;
  onTrocarFoto: () => void;
}

/** Edição do perfil: nome (máx. 60), bairro e foto. */
export function EditarPerfilDialog({ open, onOpenChange, nome, bairro, foto, onTrocarFoto }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Editar perfil" description="Seu nome e seu bairro aparecem para os outros moradores." className="max-w-[480px]">
        {/* o conteúdo só monta com o diálogo aberto: o formulário recomeça com os dados atuais */}
        <Formulario nome={nome} bairro={bairro} foto={foto} onTrocarFoto={onTrocarFoto} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function Formulario({ nome, bairro, foto, onTrocarFoto, onDone }: { nome: string; bairro: string; foto: string | null; onTrocarFoto: () => void; onDone: () => void }) {
  const [n, setN] = useState(nome);
  const [b, setB] = useState(bairro);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const router = useRouter();
  const { mutate } = useSWRConfig();

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const limpo = n.trim();
    if (!limpo) { setErro('O nome não pode ficar em branco.'); return; }
    setSalvando(true);
    setErro(null);
    try {
      await api('PUT', '/api/perfil', { nome: limpo, bairro: b });
      await mutate('/api/perfil');
      router.refresh();
      toast.success('Perfil atualizado.');
      onDone();
    } catch (err) {
      setErro(err instanceof ApiError || err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-6" noValidate>
      <div className="flex items-center gap-4">
        <Avatar nome={n || nome} foto={foto} size="lg" />
        <div className="min-w-0">
          <p className="text-base font-medium">Foto do perfil</p>
          <Button type="button" variant="ghost" size="sm" onClick={onTrocarFoto} className="-ml-3 mt-1">
            <Camera aria-hidden /> Trocar foto
          </Button>
        </div>
      </div>
      <Field label="Nome" htmlFor="perfil-nome-input" error={erro}>
        <Input id="perfil-nome-input" value={n} maxLength={60} autoComplete="name" onChange={(e) => setN(e.target.value)} aria-invalid={!!erro} />
      </Field>
      <Field label="Bairro" htmlFor="perfil-bairro-input" optional>
        <Select id="perfil-bairro-input" value={b} onChange={(e) => setB(e.target.value)}>
          <option value="">Não informar</option>
          {BAIRROS.map((x) => <option key={x} value={x}>{x}</option>)}
        </Select>
      </Field>
      <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <DialogClose asChild>
          <Button type="button" variant="secondary">Cancelar</Button>
        </DialogClose>
        <Button type="submit" loading={salvando}>Salvar alterações</Button>
      </div>
    </form>
  );
}
