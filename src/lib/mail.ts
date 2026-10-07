import { env } from '@/lib/env';

// Envio real do e-mail de recuperação de senha. Duas formas são suportadas, nenhuma delas
// com credenciais fixas no código — tudo vem de variáveis de ambiente.
//   1) Gmail (GMAIL_USER + GMAIL_APP_PASSWORD): SMTP do Gmail com "senha de app". Tem prioridade.
//   2) Resend (RESEND_API_KEY): serviço transacional dedicado.
// Sem nenhuma das duas, o fluxo cai no modo de demonstração (token exibido na resposta).
export function htmlEmailRecuperacao(link: string): string {
  return `<div style="font-family:sans-serif;font-size:14px;color:#1f2937;line-height:1.6">
    <p>Olá,</p>
    <p>Recebemos um pedido para redefinir a senha da sua conta no <strong>Urbana</strong>, o sistema de ocorrências urbanas de Braço do Norte.</p>
    <p><a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:100px;font-weight:600">Criar nova senha</a></p>
    <p style="font-size:12px;color:#6b7280">Ou copie e cole este link no navegador:<br>${link}</p>
    <p style="font-size:12px;color:#6b7280">Este link expira em 1 hora. Se você não solicitou essa alteração, pode ignorar este e-mail com segurança.</p>
  </div>`;
}

type Transporter = { sendMail(opts: Record<string, unknown>): Promise<unknown> };
const g = globalThis as unknown as { __urbanaGmail?: Transporter };

async function obterTransportadorGmail(): Promise<Transporter> {
  if (!g.__urbanaGmail) {
    const nodemailer = (await import('nodemailer')).default;
    // O Google mostra a senha de app com espaços só para facilitar a leitura — a credencial real
    // são as 16 letras sem espaço. Removemos qualquer espaço para não falhar silenciosamente.
    const gmailUser = (env.GMAIL_USER || '').trim();
    const gmailPass = (env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
    g.__urbanaGmail = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
      // Timeouts curtos: se o SMTP ficar inacessível, falha rápido e cai no fallback.
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
  }
  return g.__urbanaGmail;
}

const ASSUNTO_RECUPERACAO = 'Recuperação de senha - Urbana';

async function enviarGmail(destinatario: string, assunto: string, html: string): Promise<void> {
  const transportador = await obterTransportadorGmail();
  await transportador.sendMail({ from: `"Urbana" <${env.GMAIL_USER}>`, to: destinatario, subject: assunto, html });
}

async function enviarResend(destinatario: string, assunto: string, html: string): Promise<boolean> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY não configurada.');
  const payload = JSON.stringify({
    from: env.RESEND_FROM || 'Urbana <onboarding@resend.dev>',
    to: [destinatario],
    subject: assunto,
    html,
  });
  let resp: Response;
  try {
    resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: payload,
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
      throw new Error('Tempo esgotado ao enviar e-mail.');
    }
    throw e;
  }
  if (resp.status >= 200 && resp.status < 300) return true;
  const dataStr = await resp.text();
  throw new Error(`Resend respondeu ${resp.status}: ${dataStr.slice(0, 300)}`);
}

/**
 * Envia um e-mail pelo canal configurado: Gmail > Resend. Sem nenhum dos dois devolve `false`
 * (nada enviado); falhas de envio lançam, e quem chama decide o que fazer.
 */
export async function enviarEmail(destinatario: string, assunto: string, html: string): Promise<boolean> {
  if (env.GMAIL_USER && env.GMAIL_APP_PASSWORD) {
    await enviarGmail(destinatario, assunto, html);
    return true;
  }
  if (env.RESEND_API_KEY) return enviarResend(destinatario, assunto, html);
  return false;
}

export async function enviarEmailRecuperacaoGmail(destinatario: string, link: string): Promise<void> {
  await enviarGmail(destinatario, ASSUNTO_RECUPERACAO, htmlEmailRecuperacao(link));
}

export async function enviarEmailRecuperacaoResend(destinatario: string, link: string): Promise<boolean> {
  return enviarResend(destinatario, ASSUNTO_RECUPERACAO, htmlEmailRecuperacao(link));
}

/** Escapa texto vindo de dados (título, observação do admin) antes de entrar no HTML do e-mail. */
export function escaparHtml(texto: string): string {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** E-mail de notificação ao cidadão. `link` é opcional (sem origem pública conhecida, é omitido). */
export function htmlEmailNotificacao(titulo: string, texto: string, link?: string | null): string {
  const t = escaparHtml(titulo);
  const x = escaparHtml(texto).replace(/\n/g, '<br>');
  const botao = link
    ? `<p><a href="${escaparHtml(link)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:100px;font-weight:600">Ver ocorrência</a></p>`
    : '';
  return `<div style="font-family:sans-serif;font-size:14px;color:#1f2937;line-height:1.6">
    <p style="font-size:16px;font-weight:600;margin:0 0 8px">${t}</p>
    <p style="margin:0 0 16px">${x}</p>
    ${botao}
    <p style="font-size:12px;color:#6b7280">Você recebeu este e-mail porque registrou uma ocorrência no Urbana, o sistema de ocorrências urbanas de Braço do Norte.</p>
  </div>`;
}
