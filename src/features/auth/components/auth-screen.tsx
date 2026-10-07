'use client';

import { MapPin } from 'lucide-react';
import { motion } from 'motion/react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import useSWR, { useSWRConfig } from 'swr';
import { CountUp } from '@/components/bits';
import { AnimatedTabs, AnimatedTabsPanel, type TabItem } from '@/components/ui/animated-tabs';
import { AutoHeight } from '@/components/ui/auto-height';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api-client';
import { spring } from '@/lib/motion';
import { Sound } from '@/lib/sound';
import { GoogleButton } from './google-button';
import { LoginForm } from './login-form';
import { RecuperarSenhaDialog, RedefinirSenhaDialog } from './senha-dialogs';
import { SignupForm } from './signup-form';

const LEGACY_SESSION_KEY = 'urbaniza+_session';

const TABS: TabItem[] = [
  { value: 'login', label: 'Entrar', id: 'tab-login' },
  { value: 'cadastro', label: 'Criar conta', id: 'tab-cadastro' },
];

interface Stats { total: number; resolvida: number; atendimento: number; analise: number }

/** Tela de entrada: login, cadastro, Google, recuperar/redefinir senha e migração da sessão antiga. */
export function AuthScreen({ resetToken }: { resetToken?: string }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [aba, setAba] = useState('login');
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
    <div className="bg-auth min-h-dvh">
      {clientId && <Script src="https://accounts.google.com/gsi/client" strategy="lazyOnload" onReady={() => setGsiPronto(true)} />}
      <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col justify-center px-5 py-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring.gentle}>
          <header className="mb-8 flex flex-col items-center text-center">
            <span className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary shadow-sm">
              <MapPin className="size-7" aria-hidden />
            </span>
            <h1 className="mt-6 text-3xl font-semibold tracking-[-.015em]">Entre no Urbana</h1>
            <p className="mt-2 text-balance text-base text-fg-muted">Registre e acompanhe ocorrências urbanas em Braço do Norte.</p>
          </header>

          <div className="rounded-2xl border border-border bg-surface p-6 shadow-md sm:p-8">
            <AnimatedTabs tabs={TABS} value={aba} onValueChange={setAba} fullWidth aria-label="Entrar ou criar conta">
              <div className="mt-6">
                <AutoHeight>
                  <AnimatedTabsPanel value="login" labelledBy="tab-login">
                    <Entrada>
                      <LoginForm emailInicial={emailLogin} onSuccess={entrar} onEsqueci={() => setRecuperarAberto(true)} google={google('continue_with')} />
                    </Entrada>
                  </AnimatedTabsPanel>
                  <AnimatedTabsPanel value="cadastro" labelledBy="tab-cadastro">
                    <Entrada>
                      <SignupForm
                        google={google('signup_with')}
                        onCreated={(email) => {
                          toast.success('Conta criada! Faça login.');
                          setEmailLogin(email);
                          setAba('login');
                        }}
                      />
                    </Entrada>
                  </AnimatedTabsPanel>
                </AutoHeight>
              </div>
            </AnimatedTabs>
          </div>

          <PublicStats />
        </motion.div>
      </div>

      <RecuperarSenhaDialog open={recuperarAberto} onOpenChange={setRecuperarAberto} onToken={(token) => setRedefinir({ aberto: true, token })} />
      <RedefinirSenhaDialog
        open={redefinir.aberto}
        onOpenChange={fecharRedefinir}
        token={redefinir.token}
        onDone={() => { setAba('login'); }}
      />
    </div>
  );
}

/** Entrada suave do painel quando a aba muda. */
function Entrada({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring.smooth}>
      {children}
    </motion.div>
  );
}

function PublicStats() {
  const { data } = useSWR<Stats>('/api/stats');
  if (!data) {
    return (
      <div className="mt-8 flex justify-center" aria-hidden>
        <Skeleton className="h-5 w-64" />
      </div>
    );
  }
  const itens = [
    { n: data.total, rotulo: 'registradas' },
    { n: data.resolvida, rotulo: 'resolvidas' },
    { n: data.atendimento + data.analise, rotulo: 'em andamento' },
  ];
  return (
    <ul className="mt-8 grid grid-cols-3 gap-3 text-center text-sm text-fg-muted">
      {itens.map((i) => (
        <li key={i.rotulo}>
          <span className="tabular block text-base font-semibold text-fg">
            <CountUp to={i.n} duration={1.2} />
          </span>
          {i.rotulo}
        </li>
      ))}
    </ul>
  );
}
