import { useSyncExternalStore } from 'react';

// O app Android (mobile/, Capacitor) carrega este site num WebView e acrescenta "UrbanaApp/<versão>"
// ao user agent (appendUserAgent em mobile/capacitor.config.json).
export const APP_NATIVO_UA = 'UrbanaApp/';

/** Página aberta dentro do app Android. Só no navegador; no servidor é sempre false. */
export function noAppNativo(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent.includes(APP_NATIVO_UA);
}

const semAssinatura = () => () => {};

/**
 * Versão hook de noAppNativo: false no servidor e na hidratação, o valor real logo depois.
 * No app o WebView é bem mais fraco que um navegador, então ele desliga efeitos caros
 * (animações em loop, desfoque) — veja também o variant `app:` em globals.css.
 */
export function useAppNativo(): boolean {
  return useSyncExternalStore(semAssinatura, noAppNativo, () => false);
}
