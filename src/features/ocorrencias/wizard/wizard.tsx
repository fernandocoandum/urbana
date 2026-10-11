'use client';

import { ArrowRight, Send } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useSWRConfig } from 'swr';
import { Button } from '@/components/ui/button';
import { AutoHeight } from '@/components/ui/auto-height';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api-client';
import { resizeImageFile } from '@/lib/image';
import { Sound } from '@/lib/sound';
import { spring } from '@/lib/motion';
import { StepCategoria } from './step-categoria';
import { StepDetalhes } from './step-detalhes';
import { StepLocal } from './step-local';
import { StepRevisao } from './step-revisao';
import { Ticket, type TicketData } from './ticket';
import { camposObrigatoriosOk, ERRO_CAMPOS_OBRIGATORIOS, estadoInicial, montarPayload, proximoPasso, reducer, TOTAL_PASSOS, validarPasso, WZ_TITLES, type Passo } from './state';

const variantes = {
  entra: (dir: number) => ({ opacity: 0, x: dir * 24 }),
  centro: { opacity: 1, x: 0 },
  sai: (dir: number) => ({ opacity: 0, x: dir * -24, transition: { duration: 0.16 } }),
};

const msgErro = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : 'Erro desconhecido');

export function NovaOcorrenciaWizard({ categoriaInicial }: { categoriaInicial?: string }) {
  const [s, dispatch] = useReducer(reducer, categoriaInicial, (categoria) => (categoria ? { ...estadoInicial, categoria, step: 2 as const } : estadoInicial));
  const { mutate } = useSWRConfig();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [semFoto, setSemFoto] = useState({ aberto: false, motivo: '' });
  const decidirSemFoto = useRef<((continuar: boolean) => void) | null>(null);
  const timerCategoria = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Libera a URL local da prévia ao trocar a foto e ao sair.
  const fotoUrlAtual = useRef<string | null>(null);
  useEffect(() => { fotoUrlAtual.current = s.fotoUrl; }, [s.fotoUrl]);
  useEffect(() => () => {
    clearTimeout(timerCategoria.current);
    if (fotoUrlAtual.current) URL.revokeObjectURL(fotoUrlAtual.current);
  }, []);

  const trocarFoto = useCallback((file: File | null) => {
    if (fotoUrlAtual.current) URL.revokeObjectURL(fotoUrlAtual.current);
    dispatch({ type: 'foto', foto: file, fotoUrl: file ? URL.createObjectURL(file) : null });
  }, []);

  function escolherCategoria(categoria: string) {
    dispatch({ type: 'campo', campo: 'categoria', valor: categoria });
    clearTimeout(timerCategoria.current);
    // O passo de destino é absoluto: não importa se a pessoa clicou em "Próximo" antes dos 200ms.
    const destino: Passo = s.retorno ? 4 : 2;
    timerCategoria.current = setTimeout(() => dispatch({ type: 'ir', step: destino }), 200);
  }

  function avancar() {
    const msg = validarPasso(s.step, s);
    if (msg) {
      dispatch({ type: 'tentou' });
      toast.error(msg);
      return;
    }
    if (s.step === TOTAL_PASSOS) void enviar();
    else dispatch({ type: 'ir', step: proximoPasso(s) });
  }

  function voltar() {
    if (s.step > 1) dispatch({ type: 'ir', step: (s.step - 1) as Passo, retorno: false });
  }

  function perguntarSemFoto(motivo: string) {
    return new Promise<boolean>((resolve) => {
      decidirSemFoto.current = resolve;
      setSemFoto({ aberto: true, motivo });
    });
  }
  function responderSemFoto(continuar: boolean) {
    setSemFoto((v) => ({ ...v, aberto: false }));
    decidirSemFoto.current?.(continuar);
    decidirSemFoto.current = null;
  }

  async function enviar() {
    setErro(null);
    if (!camposObrigatoriosOk(s)) { setErro(ERRO_CAMPOS_OBRIGATORIOS); return; }
    setEnviando(true);
    try {
      let fotoUrl: string | null = null;
      if (s.foto) {
        try {
          const dataUrl = await resizeImageFile(s.foto, 1000, 0.85);
          const up = await api<{ url: string }>('POST', '/api/upload', { data: dataUrl });
          fotoUrl = up.url;
        } catch (upErr) {
          // Não ignoramos a falha em silêncio: a pessoa decide se segue sem a foto.
          const continuar = await perguntarSemFoto(msgErro(upErr));
          if (!continuar) { setEnviando(false); return; }
        }
      }
      const r = await api<{ protocolo: string; id: string }>('POST', '/api/ocorrencias', montarPayload(s, fotoUrl));
      Sound.play('success');
      void mutate('/api/ocorrencias');
      setTicket({ protocolo: r.protocolo, titulo: s.titulo.trim(), categoria: s.categoria, bairro: s.bairro, endereco: s.endereco.trim(), data: new Date() });
    } catch (e) {
      setErro(msgErro(e));
      setEnviando(false);
    }
  }

  if (ticket) return <Ticket data={ticket} />;

  const [titulo, subtitulo] = WZ_TITLES[s.step];
  const ultimo = s.step === TOTAL_PASSOS;
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col">
      <div className="mx-auto w-full max-w-[720px] flex-1 px-5 pb-10 pt-6 sm:px-8 sm:pt-8 lg:px-10">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-fg-muted">Etapa {s.step} de {TOTAL_PASSOS}</p>
          <Button asChild variant="ghost" size="sm" className="-mr-3">
            <Link href="/ocorrencias">Cancelar</Link>
          </Button>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuemin={1} aria-valuemax={TOTAL_PASSOS} aria-valuenow={s.step} aria-label="Progresso do registro">
          <motion.div className="h-full rounded-full bg-primary" initial={false} animate={{ width: `${(s.step / TOTAL_PASSOS) * 100}%` }} transition={spring.smooth} />
        </div>

        <div className="mt-8 min-h-[88px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={s.step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={spring.smooth}>
              <h1 className="text-3xl font-semibold tracking-[-.015em]">{titulo}</h1>
              <p className="mt-2 text-base text-fg-muted">{subtitulo}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {erro && (
          <p id="form-error" role="alert" className="mt-6 rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
            {erro}
          </p>
        )}

        <div className="mt-8">
          <AutoHeight>
            <div className="relative">
              <AnimatePresence mode="popLayout" initial={false} custom={s.dir}>
                <motion.div key={s.step} custom={s.dir} variants={variantes} initial="entra" animate="centro" exit="sai" transition={spring.smooth}>
                  {s.step === 1 && <StepCategoria valor={s.categoria} onEscolher={escolherCategoria} />}
                  {s.step === 2 && <StepLocal s={s} dispatch={dispatch} />}
                  {s.step === 3 && <StepDetalhes s={s} dispatch={dispatch} onFoto={trocarFoto} />}
                  {s.step === 4 && <StepRevisao s={s} onEditar={(passo) => dispatch({ type: 'ir', step: passo, retorno: true })} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </AutoHeight>
        </div>
      </div>

      <div className="sticky bottom-0 z-30 border-t border-border bg-bg/85 pb-safe backdrop-blur app:bg-bg">
        <div className="mx-auto flex w-full max-w-[720px] items-center justify-between gap-3 px-5 py-4 sm:px-8 lg:px-10">
          <Button id="wz-btn-back" variant="secondary" size="lg" onClick={voltar} className={s.step === 1 ? 'invisible' : undefined} tabIndex={s.step === 1 ? -1 : undefined}>
            Voltar
          </Button>
          <Button id="wz-btn-next" size="lg" onClick={avancar} loading={enviando} className="min-w-40">
            {enviando ? (
              'Enviando...'
            ) : ultimo ? (
              <>
                <Send aria-hidden /> Enviar ocorrência
              </>
            ) : s.retorno ? (
              'Voltar à revisão'
            ) : (
              <>
                Próximo <ArrowRight aria-hidden />
              </>
            )}
          </Button>
        </div>
      </div>

      <Dialog open={semFoto.aberto} onOpenChange={(aberto) => { if (!aberto) responderSemFoto(false); }}>
        <DialogContent
          title="Enviar sem foto?"
          description={`Não foi possível enviar a foto (${semFoto.motivo}). Deseja enviar a ocorrência mesmo assim, sem foto?`}
          footer={
            <>
              <Button variant="secondary" onClick={() => responderSemFoto(false)}>Cancelar</Button>
              <Button onClick={() => responderSemFoto(true)}>Enviar sem foto</Button>
            </>
          }
        />
      </Dialog>
    </div>
  );
}
