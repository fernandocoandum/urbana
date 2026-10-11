'use client';

// Recriado a partir do "Auth Switch" (21st.dev): um círculo azul gigante desliza entre os dois
// lados do cartão. Os estilos ficam em globals.css (.auth-switch). Os dois formulários ficam
// sempre montados; o inativo fica inert + hidden.
import { UrbanaLogo } from '@/components/shell/brand';
import { UrbaninhaMascote } from '@/features/urbaninha/urbaninha-mascote';
import { useReducedMotion } from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';

export type Modo = 'login' | 'cadastro';

interface Props {
  modo: Modo;
  onModo: (modo: Modo) => void;
  login: ReactNode;
  cadastro: ReactNode;
  /** Números públicos, mostrados dentro dos painéis azuis. */
  painel?: ReactNode;
}

const botao =
  'auth-switch__btn inline-flex h-11 shrink-0 items-center justify-center rounded-full border-2 border-white px-6 font-semibold text-white outline-none transition-[background-color,transform] duration-150 hover:-translate-y-0.5 hover:bg-white/10';

const titulo = 'text-[2rem] font-bold tracking-[-.015em] text-fg outline-none mb-5 text-center';

export function AuthSwitch({ modo, onModo, login, cadastro, painel }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const tituloLogin = useRef<HTMLHeadingElement>(null);
  const tituloCadastro = useRef<HTMLHeadingElement>(null);
  const primeira = useRef(true);
  const reduzir = useReducedMotion();

  // Troca de modo: leva o foco ao título da nova seção e, se o cartão subiu para fora da tela, rola de volta.
  useEffect(() => {
    if (primeira.current) { primeira.current = false; return; }
    (modo === 'login' ? tituloLogin : tituloCadastro).current?.focus({ preventScroll: true });
    if ((cardRef.current?.getBoundingClientRect().top ?? 0) < 0) {
      window.scrollTo({ top: 0, behavior: reduzir ? 'auto' : 'smooth' });
    }
  }, [modo, reduzir]);

  const login_ = modo === 'login';

  return (
    <div ref={cardRef} data-modo={modo} className="auth-switch">
      <h1 className="sr-only">Entrar ou criar conta no Urbana</h1>

      {/* Só no celular (< 640px): topo azul com a marca; o formulário sobe por cima dele. */}
      <div className="auth-switch__hero" aria-hidden>
        <div className="min-w-0">
          <UrbanaLogo tone="inverse" className="text-white" />
          <p className="mt-3 max-w-[220px] text-[0.95rem] leading-snug text-white/85">Registre problemas da sua rua e acompanhe até resolver.</p>
        </div>
        <UrbaninhaMascote humor="acenando" className="h-[88px] w-[78px] shrink-0 drop-shadow-[0_6px_12px_rgb(0_0_0/0.3)]" />
      </div>

      <div className="auth-switch__forms">
        <section id="form-login" aria-labelledby="titulo-login" data-ativo={login_} inert={!login_} aria-hidden={!login_} className="auth-switch__form">
          <UrbanaLogo className="auth-switch__so-mobile mb-6 justify-center" />
          <h2 id="titulo-login" ref={tituloLogin} tabIndex={-1} className={titulo}>Entrar</h2>
          {login}
        </section>
        <section id="form-cadastro" aria-labelledby="titulo-cadastro" data-ativo={!login_} inert={login_} aria-hidden={login_} className="auth-switch__form">
          <UrbanaLogo className="auth-switch__so-mobile mb-6 justify-center" />
          <h2 id="titulo-cadastro" ref={tituloCadastro} tabIndex={-1} className={titulo}>Criar conta</h2>
          {cadastro}
        </section>
      </div>

      <div className="auth-switch__panels">
        <div className="auth-switch__panel auth-switch__panel--esq">
          <div className="auth-switch__content" data-ativo={login_} inert={!login_}>
            <UrbanaLogo tone="inverse" className="auth-switch__so-desktop" />
            <div className="auth-switch__texto">
              <p className="text-2xl font-semibold leading-tight max-[869.98px]:text-xl">Novo por aqui?</p>
              <p className="text-balance text-[0.95rem] text-white/90 max-[869.98px]:text-sm">Crie sua conta e registre problemas da sua rua em poucos passos.</p>
            </div>
            {/* id estável: os testes e2e clicam em #tab-cadastro e #tab-login */}
            <button type="button" id="tab-cadastro" aria-controls="form-cadastro" onClick={() => onModo('cadastro')} className={botao}>
              Criar conta
            </button>
            <div className="auth-switch__so-desktop">{painel}</div>
          </div>
        </div>

        <div className="auth-switch__panel auth-switch__panel--dir">
          <div className="auth-switch__content" data-ativo={!login_} inert={login_}>
            <UrbanaLogo tone="inverse" className="auth-switch__so-desktop" />
            <div className="auth-switch__texto">
              <p className="text-2xl font-semibold leading-tight max-[869.98px]:text-xl">Já tem conta?</p>
              <p className="text-balance text-[0.95rem] text-white/90 max-[869.98px]:text-sm">Entre para acompanhar suas ocorrências.</p>
            </div>
            <button type="button" id="tab-login" aria-controls="form-login" onClick={() => onModo('login')} className={botao}>
              Entrar
            </button>
            <div className="auth-switch__so-desktop">{painel}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
