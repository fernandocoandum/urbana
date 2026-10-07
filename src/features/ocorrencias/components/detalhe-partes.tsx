'use client';

import { motion } from 'motion/react';
import { MapPin, Star, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Textarea } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api-client';
import { fmtDateTime } from '@/lib/format';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { HistoricoEntry, OcorrenciaDerivada, PedidoReabertura } from '@/lib/db/types';
import { MiniMapa } from '@/features/mapa/components/mini-mapa-lazy';
import { MAPA_COR_STATUS } from '@/features/mapa/mapa-utils';
import { proximaAcaoTexto } from '../proxima-acao';

const erroTexto = (e: unknown) => (e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Erro desconhecido');

function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-fg-muted">{rotulo}</dt>
      <dd className="mt-1 text-base font-medium">{children}</dd>
    </div>
  );
}

export function ResumoCard({ o, pendente }: { o: OcorrenciaDerivada; pendente: PedidoReabertura | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumo</CardTitle>
      </CardHeader>
      <div className="rounded-xl bg-primary-soft p-4">
        <p className="text-sm font-medium text-primary">Próxima ação</p>
        <p className="mt-1 text-base">{proximaAcaoTexto(o)}</p>
      </div>
      <dl className="mt-6 grid gap-5 sm:grid-cols-2">
        <Dado rotulo="Responsável">{o.responsavel ? o.responsavel : o.setor ? o.setor : 'A definir'}</Dado>
        <Dado rotulo="Última atualização">{fmtDateTime(o.atualizadoEm)}</Dado>
        <Dado rotulo="Categoria">
          <span className="inline-flex items-center gap-2">
            <CategoryIcon categoria={o.categoria} size="sm" />
            {o.categoria}
          </span>
        </Dado>
        <Dado rotulo="Bairro">{o.bairro}</Dado>
      </dl>
      {pendente && (
        <div className="mt-6 flex gap-3 rounded-xl border border-warning/30 bg-warning-soft p-4 text-base">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <p>
            Você pediu a reabertura em {fmtDateTime(pendente.data)}: &ldquo;{pendente.motivo}&rdquo; — aguardando retorno da equipe.
          </p>
        </div>
      )}
    </Card>
  );
}

export function LocalCard({ o }: { o: OcorrenciaDerivada }) {
  const temMapa = typeof o.lat === 'number' && typeof o.lng === 'number';
  return (
    <Card>
      <CardHeader>
        <CardTitle>Local e foto</CardTitle>
      </CardHeader>
      {o.foto ? (
        <img src={o.foto} alt="Foto da ocorrência" className="aspect-video w-full rounded-xl object-cover" />
      ) : (
        <div className="grid aspect-video place-items-center rounded-xl bg-surface-2">
          <div className="flex flex-col items-center gap-2 text-sm text-fg-muted">
            <CategoryIcon categoria={o.categoria} size="lg" />
            Sem foto
          </div>
        </div>
      )}
      <dl className="mt-6 grid gap-5">
        <Dado rotulo="Endereço">
          {o.endereco}
          {o.referencia ? <span className="font-normal text-fg-muted"> — {o.referencia}</span> : null}
        </Dado>
      </dl>
      {temMapa && (
        <MiniMapa lat={o.lat} lng={o.lng} cor={MAPA_COR_STATUS[o.status]} zoom={16} label="Mapa com a localização da ocorrência" className="mt-6 h-56" />
      )}
      {o.precisaoLocal === 'aproximado' && (
        <p className="mt-6 flex items-start gap-2 text-sm text-fg-muted">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
          Localização aproximada: o ponto exato não foi marcado no mapa.
        </p>
      )}
    </Card>
  );
}

export function DescricaoCard({ o }: { o: OcorrenciaDerivada }) {
  if (!o.descricao && !o.evidenciaResolucao) return null;
  return (
    <>
      {o.descricao && (
        <Card>
          <CardHeader>
            <CardTitle>Descrição</CardTitle>
          </CardHeader>
          <p className="whitespace-pre-line break-words text-base">{o.descricao}</p>
        </Card>
      )}
      {o.evidenciaResolucao && (
        <Card className="border-success/30 bg-success-soft">
          <CardHeader>
            <CardTitle>Evidência da resolução</CardTitle>
          </CardHeader>
          <p className="whitespace-pre-line break-words text-base">{o.evidenciaResolucao}</p>
        </Card>
      )}
    </>
  );
}

/** Linha do tempo completa, em ordem cronológica; reaberturas em âmbar. */
export function Historico({ historico }: { historico: HistoricoEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico</CardTitle>
      </CardHeader>
      <ol className="flex flex-col">
        {historico.map((h, i) => {
          const ultimo = i === historico.length - 1;
          const reaberta = h.tipo === 'reabertura';
          return (
            <li key={`${h.data}-${i}`} className="relative flex gap-4 pb-6 last:pb-0">
              {!ultimo && <span aria-hidden className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-border" />}
              <span
                aria-hidden
                className={cn(
                  'relative z-10 mt-1 size-6 shrink-0 rounded-full border-2 bg-surface',
                  reaberta ? 'border-warning bg-warning' : ultimo ? 'border-primary ring-4 ring-primary/15' : 'border-primary bg-primary',
                )}
              />
              <div className="min-w-0">
                <p className="text-base font-semibold">
                  {h.status}
                  {reaberta && <span className="ml-2 text-sm font-semibold text-warning">(reaberta)</span>}
                </p>
                <p className="mt-0.5 break-words text-sm text-fg-muted">
                  {fmtDateTime(h.data)}
                  {h.obs ? ` · ${h.obs}` : ''}
                  {h.setor ? ` · Setor: ${h.setor}` : ''}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function Estrelas({ valor, onChange }: { valor: number; onChange?: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  const mostrar = hover || valor;
  const somenteLeitura = !onChange;
  return (
    <div role={somenteLeitura ? 'img' : 'radiogroup'} aria-label={somenteLeitura ? `Nota ${valor} de 5` : 'Nota de 1 a 5 estrelas'} className="flex gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const cheia = n <= mostrar;
        const icone = <Star className={cn('size-9 transition-colors duration-150', cheia ? 'fill-warning text-warning' : 'text-border-strong')} aria-hidden />;
        if (somenteLeitura) return <span key={n} className="grid size-10 place-items-center">{icone}</span>;
        return (
          <motion.button
            key={n}
            type="button"
            role="radio"
            aria-checked={valor === n}
            aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.9 }}
            animate={{ scale: valor === n ? [1, 1.25, 1] : 1 }}
            transition={spring.bouncy}
            className="grid size-11 place-items-center rounded-full outline-none focus-visible:ring-4 focus-visible:ring-primary/25"
          >
            {icone}
          </motion.button>
        );
      })}
    </div>
  );
}

/** Avaliação do atendimento (só em ocorrências resolvidas). */
export function AvaliacaoCard({ o, onDone }: { o: OcorrenciaDerivada; onDone: () => void }) {
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  if (o.status !== 'Resolvida') return null;

  if (o.avaliacao) {
    return (
      <Card>
        <p className="text-sm font-medium text-primary">Sua avaliação</p>
        <div className="mt-3"><Estrelas valor={o.avaliacao.nota} /></div>
        {o.avaliacao.comentario && <p className="mt-3 break-words text-base italic text-fg-muted">&ldquo;{o.avaliacao.comentario}&rdquo;</p>}
      </Card>
    );
  }

  async function enviar() {
    if (!nota) { toast('Escolha uma nota de 1 a 5 estrelas.'); return; }
    setEnviando(true);
    try {
      await api('POST', `/api/ocorrencias/${o.id}/avaliar`, { nota, comentario: comentario.trim() });
      toast.success('Obrigado pela avaliação!');
      onDone();
    } catch (e) {
      toast.error(erroTexto(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card>
      <CardTitle>Como foi a resolução?</CardTitle>
      <div className="mt-4"><Estrelas valor={nota} onChange={setNota} /></div>
      <Textarea aria-label="Comentário (opcional)" placeholder="Comentário (opcional)" maxLength={500} className="mt-4 min-h-24" value={comentario} onChange={(e) => setComentario(e.target.value)} />
      <Button variant="secondary" className="mt-4 w-full" loading={enviando} onClick={enviar}>
        Enviar avaliação
      </Button>
    </Card>
  );
}

/** "Não foi resolvido de verdade?": pedido de reabertura (só resolvida e sem pedido pendente). */
export function ReaberturaCard({ o, pendente, onDone }: { o: OcorrenciaDerivada; pendente: PedidoReabertura | null; onDone: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  if (o.status !== 'Resolvida' || pendente) return null;

  async function enviar() {
    const m = motivo.trim();
    if (!m) { toast.error('Explique o motivo do pedido de reabertura.'); return; }
    setEnviando(true);
    try {
      await api('POST', `/api/ocorrencias/${o.id}/reabrir`, { motivo: m });
      toast.success('Pedido de reabertura enviado à prefeitura.');
      setMotivo('');
      onDone();
    } catch (e) {
      toast.error(erroTexto(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card>
      <CardTitle>Não foi resolvido de verdade?</CardTitle>
      <p className="mt-1 text-sm text-fg-muted">Conte o que ainda está errado e a prefeitura volta a analisar.</p>
      <Textarea id="reabrir-motivo" aria-label="Motivo da reabertura" placeholder="Explique o que ainda está errado..." maxLength={500} className="mt-4 min-h-24" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      <Button variant="secondary" className="mt-4 w-full" loading={enviando} onClick={enviar}>
        Pedir reabertura
      </Button>
    </Card>
  );
}
