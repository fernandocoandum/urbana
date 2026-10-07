'use client';

import { MoreVertical, ScrollText, MessagesSquare } from 'lucide-react';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { Skeleton } from '@/components/ui/skeleton';
import { PerfilPublicoDialog } from '@/features/perfil/components/perfil-publico-dialog';
import { useSession } from '@/features/auth/session-context';
import { api } from '@/lib/api-client';
import { MessageThread, type ThreadMsg } from './message-thread';

interface ChatItem { id: string; userId: string; nome: string; foto: string | null; texto: string; criadoEm: string }

const REGRAS = [
  ['Respeite os vizinhos', 'Converse como numa praça: sem xingamentos, ofensas ou discriminação.'],
  ['Mensagens são públicas', 'Todos os moradores veem o que você escreve. Não compartilhe telefone, endereço ou dados pessoais.'],
  ['Foco na cidade', 'Fale de Braço do Norte e dos seus problemas. Para um caso específico, registre uma ocorrência.'],
  ['Sem propaganda ou spam', 'Divulgação comercial e repetição de mensagens podem ser removidas.'],
] as const;

/** "Conversa da cidade": altura cheia, coluna de 760px, cabeçalho + MessageThread (variante praça). */
export function ConversaView() {
  const eu = useSession();
  const { data, error, mutate } = useSWR<ChatItem[]>('/api/chat', { refreshInterval: 4000 });
  const [regras, setRegras] = useState(false);
  const [perfilId, setPerfilId] = useState<string | null>(null);

  const mensagens: ThreadMsg[] = useMemo(
    () => (data ?? []).map((m) => ({ id: m.id, autor: m.userId, nome: m.nome, foto: m.foto, texto: m.texto, data: m.criadoEm })),
    [data],
  );

  async function enviar(texto: string) {
    await api('POST', '/api/chat', { texto });
    await mutate();
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-64px-72px-env(safe-area-inset-bottom))] w-full max-w-[760px] flex-col bg-surface md:h-[calc(100dvh-64px)] md:border-x md:border-border">
      <header className="flex h-[72px] shrink-0 items-center gap-4 border-b border-border px-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">Conversa da cidade</h1>
          <p className="truncate text-sm text-fg-muted">Moradores de Braço do Norte<span className="max-sm:hidden"> · mensagens públicas</span></p>
        </div>
        <Menu>
          <MenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Mais opções da conversa">
              <MoreVertical aria-hidden />
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem icon={ScrollText} onSelect={() => setRegras(true)}>
              Regras de convivência
            </MenuItem>
          </MenuContent>
        </Menu>
      </header>

      <div className="min-h-0 flex-1">
        {error ? (
          <EmptyState icon={MessagesSquare} title="Não foi possível carregar a conversa" description={error.message} action={<Button variant="secondary" onClick={() => void mutate()}>Tentar de novo</Button>} />
        ) : !data ? (
          <Carregando />
        ) : (
          <MessageThread variant="praça" mensagens={mensagens} ladoProprio={eu.id} onSend={enviar} onAbrirPerfil={setPerfilId} inputId="chat-input" sendTestId="chat-enviar" />
        )}
      </div>

      <Dialog open={regras} onOpenChange={setRegras}>
        <DialogContent title="Regras de convivência" description="Para a conversa continuar boa para todo mundo." footer={<DialogClose asChild><Button>Entendi</Button></DialogClose>}>
          <ol className="flex flex-col gap-5">
            {REGRAS.map(([titulo, texto], i) => (
              <li key={titulo} className="flex gap-4">
                <span className="tabular grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-base font-semibold">{titulo}</p>
                  <p className="mt-1 text-base text-fg-muted">{texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>

      <PerfilPublicoDialog userId={perfilId} onClose={() => setPerfilId(null)} />
    </div>
  );
}

function Carregando() {
  return (
    <div aria-busy="true" className="flex h-full flex-col gap-6 px-4 py-6 sm:px-6">
      <div className="flex gap-3"><Skeleton className="size-8 shrink-0 rounded-full" /><Skeleton className="h-14 w-3/5 rounded-[20px]" /></div>
      <div className="flex justify-end"><Skeleton className="h-10 w-2/5 rounded-[20px]" /></div>
      <div className="flex gap-3"><Skeleton className="size-8 shrink-0 rounded-full" /><Skeleton className="h-20 w-2/3 rounded-[20px]" /></div>
    </div>
  );
}
