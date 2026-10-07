'use client';

import { Lock, Mail, MapPin, User } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { PasswordStrength } from '@/components/ui/password-strength';
import { BAIRROS } from '@/features/ocorrencias/categorias';
import { api, ApiError } from '@/lib/api-client';
import { PillField, pillClasses } from './pill-field';

interface Props {
  /** Conta criada: o pai mostra o toast, troca para o login e preenche o e-mail. */
  onCreated: (email: string) => void;
  google?: React.ReactNode;
}

const BOTAO = 'w-full rounded-full hover:-translate-y-0.5 hover:shadow-[0_6px_16px_-4px_color-mix(in_srgb,var(--primary)_45%,transparent)]';

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
    <form onSubmit={enviar} noValidate className="flex flex-col gap-3">
      {erro && <p id="cad-error" role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">{erro}</p>}
      <PillField icon={User} label="Nome completo" htmlFor="cad-nome">
        <Input id="cad-nome" autoComplete="name" placeholder="Nome completo" className={pillClasses} value={nome} onChange={(e) => setNome(e.target.value)} />
      </PillField>
      <PillField icon={Mail} label="E-mail" htmlFor="cad-email">
        <Input id="cad-email" type="email" inputMode="email" autoComplete="username" placeholder="E-mail" className={pillClasses} value={email} onChange={(e) => setEmail(e.target.value)} />
      </PillField>
      <PillField icon={MapPin} label="Bairro (opcional)" htmlFor="cad-bairro">
        <Select id="cad-bairro" className={pillClasses} value={bairro} onChange={(e) => setBairro(e.target.value)}>
          <option value="">Bairro (opcional)</option>
          {BAIRROS.map((b) => <option key={b} value={b}>{b}</option>)}
        </Select>
      </PillField>
      <PillField icon={Lock} label="Senha" htmlFor="cad-senha">
        <PasswordStrength id="cad-senha" placeholder="Crie uma senha" className={pillClasses} value={senha} onChange={setSenha} contexto={contexto} />
      </PillField>
      <Button type="submit" id="btn-cad" size="lg" loading={carregando} className={BOTAO}>
        Criar minha conta
      </Button>
      {google}
    </form>
  );
}
