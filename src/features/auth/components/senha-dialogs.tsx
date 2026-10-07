'use client';

import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { PasswordStrength } from '@/components/ui/password-strength';
import { api, ApiError } from '@/lib/api-client';

interface RecuperarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** O servidor devolveu `tokenDemo` (sem e-mail configurado): segue direto para a redefinição. */
  onToken: (token: string) => void;
}

/** "Recuperar senha": pede o e-mail e mostra a mensagem do servidor. O tokenDemo só aparece quando vier. */
export function RecuperarSenhaDialog({ open, onOpenChange, onToken }: RecuperarProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Recuperar senha" description="Informe seu e-mail de cadastro. Enviaremos instruções para redefinir sua senha.">
        <RecuperarForm onToken={(t) => { onOpenChange(false); onToken(t); }} />
      </DialogContent>
    </Dialog>
  );
}

function RecuperarForm({ onToken }: { onToken: (t: string) => void }) {
  const [email, setEmail] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string; token?: string } | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const valor = email.trim();
    if (!valor) { setResultado({ ok: false, texto: 'Informe um e-mail.' }); return; }
    setCarregando(true);
    try {
      const r = await api<{ mensagem: string; tokenDemo?: string }>('POST', '/api/recuperar-senha', { email: valor });
      setResultado({ ok: true, texto: r.mensagem, token: r.tokenDemo });
    } catch (err) {
      setResultado({ ok: false, texto: err instanceof ApiError ? err.message : 'Erro desconhecido' });
    } finally {
      setCarregando(false);
    }
  }

  const enviado = resultado?.ok === true;
  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
      <Field label="E-mail" htmlFor="rec-email">
        <Input id="rec-email" type="email" placeholder="seu@email.com" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} disabled={enviado} />
      </Field>
      {resultado && (
        <p role="alert" className={resultado.ok ? 'rounded-md bg-success-soft px-4 py-3 text-sm text-success' : 'rounded-md bg-danger-soft px-4 py-3 text-sm text-danger'}>
          {resultado.texto}
        </p>
      )}
      {resultado?.token && (
        <Button type="button" variant="secondary" onClick={() => onToken(resultado.token!)}>
          Continuar para redefinir a senha
        </Button>
      )}
      {!enviado && (
        <Button type="submit" id="rec-btn" size="lg" loading={carregando} className="w-full">
          Enviar instruções
        </Button>
      )}
    </form>
  );
}

interface RedefinirProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  /** Senha trocada com sucesso: o pai volta para a aba de login. */
  onDone: () => void;
}

/** "Definir nova senha": abre sozinho com `?reset=TOKEN`. Só pede o token se ele não vier no link. */
export function RedefinirSenhaDialog({ open, onOpenChange, token, onDone }: RedefinirProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Definir nova senha" description="Escolha uma senha nova para entrar no Urbana.">
        <RedefinirForm token={token} onDone={() => { onOpenChange(false); onDone(); }} />
      </DialogContent>
    </Dialog>
  );
}

function RedefinirForm({ token: tokenInicial, onDone }: { token: string; onDone: () => void }) {
  const [token, setToken] = useState(tokenInicial);
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const t = token.trim();
    if (!t) { setErro('Cole o token recebido.'); return; }
    if (senha.length < 6) { setErro('A senha precisa ter ao menos 6 caracteres.'); return; }
    setCarregando(true);
    try {
      await api('POST', '/api/redefinir-senha', { token: t, senha });
      toast.success('Senha redefinida! Faça login com a nova senha.');
      onDone();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Erro desconhecido');
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
      {!tokenInicial && (
        <Field label="Token de redefinição" htmlFor="redef-token">
          <Input id="redef-token" placeholder="Cole aqui o token recebido" value={token} onChange={(e) => setToken(e.target.value)} />
        </Field>
      )}
      <Field label="Nova senha" htmlFor="redef-senha">
        <PasswordStrength id="redef-senha" value={senha} onChange={setSenha} />
      </Field>
      {erro && <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">{erro}</p>}
      <Button type="submit" id="redef-btn" size="lg" loading={carregando} className="w-full">
        Redefinir senha
      </Button>
    </form>
  );
}
