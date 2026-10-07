'use client';

import { useTheme } from 'next-themes';
import { useEffect, useRef } from 'react';

// O GIS só aceita um `initialize` por página: o callback atual fica num módulo-nível.
let inicializado = false;
let callbackAtual: ((credential: string) => void) | null = null;

/** Botão "Continuar com o Google" (GIS). Só renderiza quando o script já carregou (`ready`). */
export function GoogleButton({ clientId, text, onCredential }: { clientId: string; text: 'continue_with' | 'signup_with'; onCredential: (credential: string) => void }) {
  const slot = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    callbackAtual = onCredential;
  });

  useEffect(() => {
    const el = slot.current;
    const id = window.google?.accounts.id;
    if (!el || !id) return;
    if (!inicializado) {
      id.initialize({ client_id: clientId, callback: (r) => callbackAtual?.(r.credential), ux_mode: 'popup' });
      inicializado = true;
    }
    el.replaceChildren();
    const largura = Math.min(400, Math.max(200, Math.round(el.offsetWidth || 320)));
    id.renderButton(el, { theme: resolvedTheme === 'dark' ? 'filled_black' : 'outline', size: 'large', shape: 'pill', text, locale: 'pt-BR', width: largura });
  }, [clientId, text, resolvedTheme]);

  // color-scheme light: o iframe do GIS é um documento claro; sob a página em `dark` o navegador
  // pintaria um fundo branco opaco atrás dele (o retângulo branco em volta da pílula no modo noturno).
  return <div ref={slot} className="flex min-h-11 w-full justify-center [color-scheme:light]" />;
}
