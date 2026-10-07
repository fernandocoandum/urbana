'use client';

import { CheckCircle2, Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { STATUS_LISTA } from '@/features/ocorrencias/categorias';
import { pedidoPendente } from '@/features/ocorrencias/proxima-acao';
import { api, ApiError } from '@/lib/api-client';
import { celebrar } from '@/lib/celebrar';
import { SETORES } from '@/lib/constants';
import type { OcorrenciaDerivada } from '@/lib/db/types';
import { diaBR } from '../fila';
import { ehRegressao, validarMudancaStatus } from '../validar-status';

export interface EstadoForm {
  status: string;
  responsavel: string;
  /** yyyy-mm-dd (campo date) */
  prazo: string;
  obs: string;
  evidencia: string;
  setor: string;
  obsEncaminhar: string;
}

export function estadoInicial(o: OcorrenciaDerivada): EstadoForm {
  return {
    status: o.status,
    responsavel: o.responsavel ?? '',
    prazo: o.prazo ? diaBR(o.prazo) : '',
    obs: '',
    evidencia: '',
    setor: o.setor ?? '',
    obsEncaminhar: '',
  };
}

/** Data do campo `date` → ISO ao meio-dia de Braço do Norte (UTC-3, sem horário de verão): o dia não escorrega. */
export function prazoParaIso(dia: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(dia) ? `${dia}T12:00:00-03:00` : null;
}

const DICA: Record<string, string> = {
  'Recebida': 'Registrada e aguardando triagem.',
  'Em análise': 'A equipe está avaliando o problema.',
  'Encaminhada': 'Enviada ao setor responsável. A aba Encaminhar permite escolher o setor.',
  'Em atendimento': 'A equipe está em campo resolvendo.',
  'Resolvida': 'Informe a evidência da resolução. O cidadão poderá avaliar o atendimento.',
};

const erroTexto = (e: unknown) => (e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Erro desconhecido');

interface Payload { status: string; obs?: string; setor?: string; responsavel?: string; prazo?: string | null; evidencia?: string }

/** PUT do status com toast, celebração e revalidação do que depende dele. Devolve true se salvou. */
export function useSalvarStatus(o: OcorrenciaDerivada, depois: () => Promise<unknown>) {
  const [salvando, setSalvando] = useState(false);
  async function salvar(payload: Payload, mensagem = 'Ocorrência atualizada.'): Promise<boolean> {
    setSalvando(true);
    try {
      await api('PUT', `/api/ocorrencias/${encodeURIComponent(o.id)}/status`, payload);
      toast.success(payload.status === 'Resolvida' && o.status !== 'Resolvida' ? 'Ocorrência resolvida. O cidadão foi avisado.' : mensagem);
      if (payload.status === 'Resolvida' && o.status !== 'Resolvida') celebrar();
      await depois();
      return true;
    } catch (e) {
      toast.error(erroTexto(e));
      return false;
    } finally {
      setSalvando(false);
    }
  }
  return { salvando, salvar };
}

interface FormProps {
  o: OcorrenciaDerivada;
  form: EstadoForm;
  setForm: (p: Partial<EstadoForm>) => void;
  salvar: ReturnType<typeof useSalvarStatus>['salvar'];
  salvando: boolean;
  onSalvo: () => void;
}

export function FormStatus({ o, form, setForm, salvar, salvando, onSalvo }: FormProps) {
  const [erros, setErros] = useState<{ obs?: string; evidencia?: string }>({});
  const regressao = ehRegressao(o.status, form.status);
  const pendente = pedidoPendente(o);
  const resolvendo = form.status === 'Resolvida';

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const v = validarMudancaStatus({ atual: o, novo: form.status, obs: form.obs, evidencia: resolvendo ? form.evidencia : undefined });
    if (!v.ok) {
      setErros({ [v.campo]: v.erro });
      document.getElementById(v.campo === 'obs' ? 'gestao-obs' : 'gestao-evidencia')?.focus();
      return;
    }
    setErros({});
    const ok = await salvar({
      status: form.status,
      obs: form.obs.trim() || undefined,
      responsavel: form.responsavel.trim(),
      prazo: prazoParaIso(form.prazo),
      ...(resolvendo && form.evidencia.trim() ? { evidencia: form.evidencia.trim() } : {}),
    });
    if (ok) onSalvo();
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5" noValidate>
      <Field label="Status" htmlFor="gestao-status" hint={regressao ? undefined : DICA[form.status]}>
        <Select id="gestao-status" value={form.status} onChange={(e) => { setForm({ status: e.target.value }); setErros({}); }}>
          {STATUS_LISTA.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        {regressao && <p className="text-sm text-warning">Você está retrocedendo o status: informe a justificativa. O cidadão será avisado.</p>}
      </Field>
      <Field label="Responsável" htmlFor="gestao-responsavel" optional>
        <Input id="gestao-responsavel" value={form.responsavel} maxLength={100} placeholder="Nome ou equipe" onChange={(e) => setForm({ responsavel: e.target.value })} />
      </Field>
      <Field label="Prazo de retorno" htmlFor="gestao-prazo" optional>
        <Input id="gestao-prazo" type="date" value={form.prazo} onChange={(e) => setForm({ prazo: e.target.value })} />
      </Field>
      {resolvendo && (
        <Field label="Evidência da resolução" htmlFor="gestao-evidencia" error={erros.evidencia} hint="O que foi feito e onde. Aparece para o cidadão.">
          <Textarea id="gestao-evidencia" value={form.evidencia} maxLength={500} aria-invalid={!!erros.evidencia} className="min-h-24" placeholder="Ex.: Buraco tapado com massa asfáltica em 06/10." onChange={(e) => setForm({ evidencia: e.target.value })} />
        </Field>
      )}
      <Field
        label={regressao || (pendente && resolvendo) ? 'Justificativa' : 'Observação'}
        htmlFor="gestao-obs"
        optional={!regressao && !(pendente && resolvendo)}
        error={erros.obs}
        hint="Vai para o histórico e para a notificação do cidadão."
      >
        <Textarea id="gestao-obs" value={form.obs} maxLength={500} aria-invalid={!!erros.obs} className="min-h-24" onChange={(e) => setForm({ obs: e.target.value })} />
      </Field>
      <Button type="submit" loading={salvando} size="lg" className="w-full">
        <CheckCircle2 aria-hidden /> Salvar alterações
      </Button>
    </form>
  );
}

export function FormEncaminhar({ o, form, setForm, salvar, salvando, onSalvo }: FormProps) {
  const [erro, setErro] = useState<string | null>(null);
  if (o.status === 'Resolvida') {
    return <p className="rounded-xl bg-surface-2 p-4 text-base text-fg-muted">Esta ocorrência está resolvida. Para encaminhar de novo, reabra-a na aba Status.</p>;
  }
  // Antes do encaminhamento o status passa a "Encaminhada"; depois disso fica como está (só troca o setor).
  const statusFinal = o.status === 'Recebida' || o.status === 'Em análise' ? 'Encaminhada' : o.status;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.setor) { setErro('Escolha o setor responsável.'); return; }
    setErro(null);
    const ok = await salvar({ status: statusFinal, setor: form.setor, obs: form.obsEncaminhar.trim() || `Encaminhada para ${form.setor}`, ...(form.responsavel.trim() ? { responsavel: form.responsavel.trim() } : {}) }, `Encaminhada para ${form.setor}.`);
    if (ok) { setForm({ obsEncaminhar: '' }); onSalvo(); }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5" noValidate>
      {o.setor && <p className="text-sm text-fg-muted">Setor atual: <strong className="font-semibold text-fg">{o.setor}</strong></p>}
      <Field label="Setor responsável" htmlFor="gestao-setor" error={erro}>
        <Select id="gestao-setor" value={form.setor} aria-invalid={!!erro} onChange={(e) => setForm({ setor: e.target.value })}>
          <option value="">Escolha o setor</option>
          {SETORES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </Field>
      <Field label="Observação" htmlFor="gestao-obs-enc" optional hint="O cidadão recebe esta mensagem junto com o aviso.">
        <Textarea id="gestao-obs-enc" value={form.obsEncaminhar} maxLength={500} className="min-h-24" onChange={(e) => setForm({ obsEncaminhar: e.target.value })} />
      </Field>
      <Button type="submit" loading={salvando} size="lg" className="w-full">
        <Send aria-hidden /> Encaminhar
      </Button>
    </form>
  );
}

/** "Marcar resolvida": pede a evidência (e a justificativa, se há pedido de reabertura pendente) num diálogo. */
export function DialogResolver({ o, open, onOpenChange, salvar, salvando, onSalvo }: { o: OcorrenciaDerivada; open: boolean; onOpenChange: (v: boolean) => void; salvar: ReturnType<typeof useSalvarStatus>['salvar']; salvando: boolean; onSalvo: () => void }) {
  const [evidencia, setEvidencia] = useState('');
  const [obs, setObs] = useState('');
  const [erros, setErros] = useState<{ obs?: string; evidencia?: string }>({});
  const pendente = !!pedidoPendente(o);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    const v = validarMudancaStatus({ atual: o, novo: 'Resolvida', obs, evidencia });
    if (!v.ok) { setErros({ [v.campo]: v.erro }); return; }
    setErros({});
    const ok = await salvar({ status: 'Resolvida', evidencia: evidencia.trim(), obs: obs.trim() || undefined });
    if (ok) { setEvidencia(''); setObs(''); onOpenChange(false); onSalvo(); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Marcar como resolvida" description="Descreva o que foi feito. O cidadão será avisado e poderá avaliar.">
        <form onSubmit={confirmar} className="flex flex-col gap-5" noValidate>
          <Field label="Evidência da resolução" htmlFor="resolver-evidencia" error={erros.evidencia}>
            <Textarea id="resolver-evidencia" autoFocus value={evidencia} maxLength={500} aria-invalid={!!erros.evidencia} className="min-h-28" placeholder="Ex.: Lâmpada trocada e poste testado." onChange={(e) => setEvidencia(e.target.value)} />
          </Field>
          <Field label={pendente ? 'Justificativa' : 'Observação'} htmlFor="resolver-obs" optional={!pendente} error={erros.obs} hint={pendente ? 'Há um pedido de reabertura: explique por que a ocorrência está resolvida.' : undefined}>
            <Textarea id="resolver-obs" value={obs} maxLength={500} aria-invalid={!!erros.obs} className="min-h-20" onChange={(e) => setObs(e.target.value)} />
          </Field>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" loading={salvando}><CheckCircle2 aria-hidden /> Marcar resolvida</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
