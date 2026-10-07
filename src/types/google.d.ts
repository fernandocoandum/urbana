// Tipos mínimos do Google Identity Services (carregado via next/script só quando há GOOGLE_CLIENT_ID).
export {};

declare global {
  interface GoogleIdentityConfig {
    client_id: string;
    callback: (resp: { credential: string }) => void;
    ux_mode?: 'popup' | 'redirect';
  }
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdentityConfig) => void;
          renderButton: (el: HTMLElement, options: Record<string, string | number>) => void;
        };
      };
    };
  }
}
