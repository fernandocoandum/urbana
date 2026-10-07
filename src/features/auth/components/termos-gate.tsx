'use client';

import { ScrollText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useSWRConfig } from 'swr';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api-client';
import { useSession } from '../session-context';

// Texto dos termos copiado do app legado (#termos-modal).
export const TERMOS: { titulo: string; texto: string }[] = [
  { titulo: '1. Sobre o Urbana.', texto: 'O Urbana é um canal para que moradores de Braço do Norte relatem problemas de infraestrutura urbana (buracos, iluminação, limpeza, sinalização, drenagem e afins) à Prefeitura, e acompanhem o andamento de cada relato.' },
  { titulo: '2. Cadastro.', texto: 'Ao criar uma conta, você declara que as informações fornecidas (nome, e-mail e bairro) são verdadeiras. Você é responsável por manter sua senha em sigilo e por tudo o que for feito através da sua conta.' },
  { titulo: '3. Conteúdo enviado.', texto: 'As ocorrências, descrições, fotos e localização que você enviar devem ser verídicas e relacionadas a problemas reais de infraestrutura pública. Não é permitido enviar denúncias falsas, ofensivas, discriminatórias ou sem relação com o propósito do app. A Prefeitura pode rejeitar ou remover conteúdo que viole estas regras.' },
  { titulo: '4. Localização.', texto: 'Ao usar o recurso de localização automática, você autoriza o Urbana a acessar a posição aproximada do seu dispositivo apenas para preencher o endereço da ocorrência. Essa informação é usada somente dentro do app.' },
  { titulo: '5. Apoio entre moradores.', texto: 'Ocorrências de outros moradores podem ficar visíveis publicamente no mapa da cidade (sem exibir dados pessoais de quem registrou) para que você possa confirmar que também enfrenta o mesmo problema.' },
  { titulo: '6. Prazos.', texto: 'O Urbana é um canal de comunicação — o registro de uma ocorrência não garante um prazo específico de resolução, que depende da avaliação e da capacidade operacional da Prefeitura.' },
  { titulo: '7. Privacidade.', texto: 'Seus dados de cadastro são usados apenas para o funcionamento do sistema (identificação, contato e histórico de ocorrências) e não são compartilhados com terceiros.' },
  { titulo: '8. Aceite.', texto: 'Este é um projeto acadêmico desenvolvido para fins de estudo. Ao clicar em "Li e aceito os termos", você confirma que leu e concorda com as condições acima.' },
];

/** Dialog obrigatório dos termos de uso: não fecha com Esc nem clicando fora; só aceitar ou recusar. */
export function TermosGate() {
  const user = useSession();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [aceitos, setAceitos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const aberto = !user.termosAceitos && !aceitos;

  async function aceitar() {
    setEnviando(true);
    try {
      await api('POST', '/api/aceitar-termos');
      setAceitos(true);
      router.refresh(); // o layout (servidor) relê o usuário com termosAceitos = true
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro desconhecido');
    } finally {
      setEnviando(false);
    }
  }

  async function recusar() {
    try { await api('POST', '/api/logout'); } catch { /* sessão já inválida: segue */ }
    await mutate(() => true, undefined, { revalidate: false });
    toast('É preciso aceitar os termos de uso para continuar.');
    router.replace('/entrar');
  }

  return (
    <Dialog open={aberto}>
      <DialogContent
        id="termos-modal"
        title="Termo de Uso"
        description="Leia com atenção antes de continuar"
        dismissible={false}
        className="max-w-[560px]"
        stickyFooter
        footer={
          <>
            <Button variant="ghost" id="termos-btn-recusar" onClick={recusar} disabled={enviando}>
              Recusar e sair
            </Button>
            <Button id="termos-btn-aceitar" autoFocus onClick={aceitar} loading={enviando}>
              {enviando ? 'Confirmando...' : 'Li e aceito os termos'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 text-base text-fg-muted">
          <span className="grid size-12 place-items-center rounded-full bg-primary-soft text-primary" aria-hidden>
            <ScrollText className="size-6" />
          </span>
          {TERMOS.map((t) => (
            <p key={t.titulo}>
              <strong className="font-semibold text-fg">{t.titulo}</strong> {t.texto}
            </p>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
