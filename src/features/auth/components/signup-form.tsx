'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { PasswordStrength } from '@/components/ui/password-strength';
import { BAIRROS } from '@/features/ocorrencias/categorias';
import { api, ApiError } from '@/lib/api-client';

interface Props {
  /** Conta criada: o pai mostra o toast, troca para o login e preenche o e-mail. */
  onCreated: (email: string) => void;
  google?: React.ReactNode;
}

export function SignupForm({ onCreated, google }: Props) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [bairro, setBairro] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const contexto = useMemo(() => ({ nome, email }), [nome, email]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 6) { setErro('Senha deve ter no mínimo 6 caracteres.'); return; }
    setCarregando(true);
    try {
      await api('POST', '/api/cadastro', { nome: nome.trim(), email: email.trim(), senha, bairro });
      onCreated(email.trim());
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : 'Erro desconhecido');
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
      {erro && <p id="cad-error" role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">{erro}</p>}
      <Field label="Nome completo" htmlFor="cad-nome">
        <Input id="cad-nome" autoComplete="name" placeholder="Como você se chama" value={nome} onChange={(e) => setNome(e.target.value)} />
      </Field>
      <Field label="E-mail" htmlFor="cad-email">
        <Input id="cad-email" type="email" inputMode="email" autoComplete="username" placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Bairro" htmlFor="cad-bairro" optional>
        <Select id="cad-bairro" value={bairro} onChange={(e) => setBairro(e.target.value)}>
          <option value="">Selecione...</option>
          {BAIRROS.map((b) => <option key={b} value={b}>{b}</option>)}
        </Select>
      </Field>
      <Field label="Senha" htmlFor="cad-senha">
        <PasswordStrength id="cad-senha" value={senha} onChange={setSenha} contexto={contexto} />
      </Field>
      <Button type="submit" id="btn-cad" size="lg" loading={carregando} className="w-full">
        Criar minha conta
      </Button>
      {google}
    </form>
  );
}
