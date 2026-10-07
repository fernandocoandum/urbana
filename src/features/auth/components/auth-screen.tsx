'use client';

import { motion } from 'motion/react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import useSWR, { useSWRConfig } from 'swr';
import { CountUp } from '@/components/bits';
import { api, ApiError } from '@/lib/api-client';
import { spring } from '@/lib/motion';
import { Sound } from '@/lib/sound';
import { AuthSwitch, type Modo } from './auth-switch';
import { GoogleButton } from './google-button';
import { LoginForm } from './login-form';
import { RecuperarSenhaDialog, RedefinirSenhaDialog } from './senha-dialogs';
import { SignupForm } from './signup-form';

const LEGACY_SESSION_KEY = 'urbaniza+_session';

interface Stats { total: number; resolvida: number; atendimento: number; analise: number }

/** Tela de entrada: login, cadastro, Google, recuperar/redefinir senha e migração da sessão antiga. */
export function AuthScreen({ resetToken }: { resetToken?: string }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [modo, setModo] = useState<Modo>('login');
  const [cadastroKey, setCadastroKey] = useState(0);
  const [emailLogin, setEmailLogin] = useState('');
  const [recuperarAberto, setRecuperarAberto] = useState(false);
  const [redefinir, setRedefinir] = useState<{ aberto: boolean; token: string }>({ aberto: !!resetToken, token: resetToken ?? '' });
  const [gsiPronto, setGsiPronto] = useState(false);
  const { data: config } = useSWR<{ googleClientId: string | null }>('/api/config');
  const clientId = config?.googleClientId ?? null;

  // Migração da sessão antiga: quem estava logado só com o token no localStorage ganha o cookie.
  useEffect(() => {
    let raw: string | null = null;
    try { raw = localStorage.getItem(LEGACY_SESSION_KEY); } catch { return; }
    if (!raw) return;
    let token = '';
    try { token = String((JSON.parse(raw) as { token?: unknown })?.token ?? ''); } catch { /* JSON inválido: só apaga */ }
    const apagar = () => { try { localStorage.removeItem(LEGACY_SESSION_KEY); } catch { /* storage bloqueado */ } };
    if (!token) { apagar(); return; }
    fetch('/api/me', { headers: { Authorization: 'Bearer ' + token }, credentials: 'same-origin' })
      .then((res) => {
        apagar();
        if (res.ok && !resetToken) router.replace('/');
      })
      .catch(apagar);
  }, [router, resetToken]);

  const entrar = useCallback(async () => {
    await mutate(() => true, undefined, { revalidate: false }); // descarta dados de quem usou antes
    router.replace('/');
  }, [mutate, router]);

  const entrarComGoogle = useCallback(
    async (credential: string) => {
      try {
        await api('POST', '/api/login/google', { credential });
        Sound.play('success');
        await entrar();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Erro desconhecido');
      }
    },
    [entrar],
  );

  function fecharRedefinir(aberto: boolean) {
    setRedefinir((r) => ({ ...r, aberto }));
    if (!aberto && resetToken) router.replace('/entrar'); // tira o token da barra de endereço
  }

  const google = (text: 'continue_with' | 'signup_with') =>
    clientId && gsiPronto ? (
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-4 text-sm text-fg-subtle" aria-hidden>
          <span className="h-px flex-1 bg-border" />
          ou
          <span className="h-px flex-1 bg-border" />
        </div>
        <GoogleButton clientId={clientId} text={text} onCredential={entrarComGoogle} />
      </div>
    ) : null;

  return (
    <div className="bg-auth grid min-h-dvh place-items-center p-3 sm:p-6">
      {clientId && <Script src="https://accounts.google.com/gsi/client" strategy="lazyOnload" onReady={() => setGsiPronto(true)} />}
      <motion.div className="w-full" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring.gentle}>
        <AuthSwitch
          modo={modo}
          onModo={setModo}
          painel={<PublicStats />}
          login={
            // key: o e-mail do cadastro recém-criado só entra no estado inicial do formulário
            <LoginForm key={emailLogin} emailInicial={emailLogin} onSuccess={entrar} onEsqueci={() => setRecuperarAberto(true)} google={google('continue_with')} />
          }
          cadastro={
            // key: os dois formulários ficam montados; remonta para limpar campos e o "carregando"
            <SignupForm
              key={cadastroKey}
              google={google('signup_with')}
              onCreated={(email) => {
                toast.success('Conta criada! Faça login.');
                setEmailLogin(email);
                setCadastroKey((k) => k + 1);
                setModo('login');
              }}
            />
          }
        />
      </motion.div>

      <RecuperarSenhaDialog open={recuperarAberto} onOpenChange={setRecuperarAberto} onToken={(token) => setRedefinir({ aberto: true, token })} />
      <RedefinirSenhaDialog
        open={redefinir.aberto}
        onOpenChange={fecharRedefinir}
        token={redefinir.token}
        onDone={() => { setModo('login'); }}
      />
    </div>
  );
}

function PublicStats() {
  const { data } = useSWR<Stats>('/api/stats');
  if (!data) return <div className="h-12" aria-hidden />;
  const itens = [
    { n: data.total, rotulo: 'registradas' },
    { n: data.resolvida, rotulo: 'resolvidas' },
    { n: data.atendimento + data.analise, rotulo: 'em andamento' },
  ];
  return (
    <ul className="grid grid-cols-3 gap-3 text-center">
      {itens.map((i) => (
        <li key={i.rotulo}>
          <span className="tabular block text-xl font-semibold text-white">
            <CountUp to={i.n} duration={1.2} />
          </span>
          <span className="text-sm text-white/80">{i.rotulo}</span>
        </li>
      ))}
    </ul>
  );
}
