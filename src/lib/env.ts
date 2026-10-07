// Leitura preguiçosa de process.env: nunca no import do módulo (o `next build` coleta as rotas sem
// variáveis de ambiente de produção, e o Vitest define as suas depois de carregar este arquivo).
export const env = {
  get DATABASE_URL() { return process.env.DATABASE_URL; },
  get VERCEL() { return process.env.VERCEL; },
  get URBANA_DB_FILE() { return process.env.URBANA_DB_FILE; },
  get ADMIN_EMAIL() { return process.env.ADMIN_EMAIL; },
  get ADMIN_NOME() { return process.env.ADMIN_NOME; },
  get ADMIN_SENHA() { return process.env.ADMIN_SENHA; },
  get GOOGLE_CLIENT_ID() { return process.env.GOOGLE_CLIENT_ID; },
  get GMAIL_USER() { return process.env.GMAIL_USER; },
  get GMAIL_APP_PASSWORD() { return process.env.GMAIL_APP_PASSWORD; },
  get RESEND_API_KEY() { return process.env.RESEND_API_KEY; },
  get RESEND_FROM() { return process.env.RESEND_FROM; },
  get PUBLIC_ORIGIN() { return process.env.PUBLIC_ORIGIN; },
  get VERCEL_URL() { return process.env.VERCEL_URL; },
  get DEBUG_EXPOSE_RESET_TOKEN() { return process.env.DEBUG_EXPOSE_RESET_TOKEN; },
};

// Presença de DATABASE_URL é tratada como "ambiente de produção": nesse modo, uma falha do
// Postgres NUNCA cai silenciosamente para o banco JSON local — a API responde 503.
export function isProdIntent(): boolean {
  return !!env.DATABASE_URL;
}
