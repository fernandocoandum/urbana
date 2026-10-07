'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { api, ApiError } from '@/lib/api-client';
import { Sound } from '@/lib/sound';

interface Props {
  emailInicial?: string;
  onSuccess: () => void;
  onEsqueci: () => void;
  /** Botão do Google (já renderizado pelo pai quando disponível). */
  google?: React.ReactNode;
}

export function LoginForm({ emailInicial = '', onSuccess, onEsqueci, google }: Props) {
  const [email, setEmail] = useState(emailInicial);
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      await api('POST', '/api/login', { email: email.trim(), senha });
      Sound.play('success');
      onSuccess(); // mantém o botão em "carregando" até a navegação
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Erro desconhecido');
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
      {erro && <p id="login-error" role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">{erro}</p>}
      <Field label="E-mail" htmlFor="login-email">
        <Input id="login-email" type="email" inputMode="email" placeholder="voce@email.com" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <div className="flex flex-col gap-2">
        <Field label="Senha" htmlFor="login-senha">
          <PasswordInput id="login-senha" placeholder="Sua senha" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </Field>
        <button type="button" onClick={onEsqueci} className="-my-1 inline-flex min-h-9 items-center self-end rounded-md px-1 text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-4 focus-visible:ring-primary/25">
          Esqueceu a senha?
        </button>
      </div>
      <Button type="submit" id="btn-login" size="lg" loading={carregando} className="w-full">
        Entrar
      </Button>
      {google}
    </form>
  );
}
