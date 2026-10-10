// O app Android (mobile/, Capacitor) carrega este site num WebView e acrescenta "UrbanaApp/<versão>"
// ao user agent (appendUserAgent em mobile/capacitor.config.json).
export const APP_NATIVO_UA = 'UrbanaApp/';

/** Página aberta dentro do app Android. Só no navegador; no servidor é sempre false. */
export function noAppNativo(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent.includes(APP_NATIVO_UA);
}
