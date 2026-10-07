import crypto from 'node:crypto';
import { SESSION_TTL_MS, BAIRROS_VALIDOS } from '@/lib/constants';
import { genToken, hashPassword, isLegacyHash, verifyPassword } from '@/lib/crypto';
import { getDb } from '@/lib/db';
import type { User } from '@/lib/db/types';
import { env, isProdIntent } from '@/lib/env';
import { verificarTokenGoogle } from '@/lib/google';
import type { ReadBody, ServiceResult } from '@/lib/http';
import { enviarEmailRecuperacaoGmail, enviarEmailRecuperacaoResend } from '@/lib/mail';
import { rateLimit } from '@/lib/rate-limit';
import { cap, EMAIL_RE } from '@/lib/validation';
import type { Auth } from './session';

const j = (status: number, body: unknown, extra: Partial<ServiceResult> = {}): ServiceResult => ({ status, body, ...extra });

function sessaoBody(token: string, user: User) {
  return { token, role:user.role, nome:user.nome, email:user.email, id:user.id, termosAceitos: !!user.termosAceitosEm, foto:user.foto||null };
}

export async function cadastrar(ip: string, readBody: ReadBody): Promise<ServiceResult> {
  const db = await getDb();
  const rl = rateLimit('cadastro:' + ip, 8, 60 * 60 * 1000);
  if (rl.limited) return j(429, { erro: `Muitas tentativas. Tente novamente em ${Math.ceil(rl.retryAfter!/60)} min.` });
  const { nome, email, senha, bairro } = await readBody();
  if (typeof nome !== 'string' || !nome.trim() || typeof email !== 'string' || !email.trim() || typeof senha !== 'string' || !senha) return j(400, { erro:'Preencha todos os campos.' });
  if (email.length > 254 || nome.length > 300) return j(400, { erro:'Campo excede o tamanho máximo.' });
  const emailNorm = email.trim().toLowerCase();
  if (!EMAIL_RE.test(emailNorm)) return j(400, { erro:'E-mail inválido.' });
  if (senha.length < 6) return j(400, { erro:'Senha deve ter no mínimo 6 caracteres.' });
  if (senha.length > 200) return j(400, { erro:'Senha muito longa.' });
  // Mesma lista fechada de bairros usada ao registrar uma ocorrência — sem isso, o campo
  // (um <select> no formulário, mas qualquer texto via chamada direta à API) aceitava
  // qualquer string arbitrária no cadastro.
  if (bairro !== undefined && bairro !== '' && !BAIRROS_VALIDOS.has(bairro)) return j(400, { erro:'Bairro inválido.' });
  if (await db.emailExists(emailNorm)) return j(400, { erro:'E-mail já cadastrado.' });
  await db.createUser({ id:'u'+Date.now()+Math.random().toString(36).slice(2,7), nome:cap(nome,100) as string, email:emailNorm, senha:hashPassword(senha), role:'morador', bairro:(cap(bairro,60) as string)||'', foto:null });
  return j(201, { ok:true });
}

export async function login(ip: string, readBody: ReadBody): Promise<ServiceResult> {
  const db = await getDb();
  const rl = rateLimit('login:' + ip, 10, 15 * 60 * 1000);
  if (rl.limited) return j(429, { erro: `Muitas tentativas de login. Tente novamente em ${Math.ceil(rl.retryAfter!/60)} min.` });
  const { email, senha } = await readBody();
  if (typeof email !== 'string' || !email.trim() || typeof senha !== 'string' || !senha) return j(400, { erro:'Preencha e-mail e senha.' });
  // Limite de tamanho ANTES de gastar CPU com scrypt: sem isso, um payload de senha
  // gigante (o body aceita até 20MB) força o servidor a derivar hash de uma entrada enorme
  // a cada tentativa — um vetor barato de negação de serviço, mesmo com rate limit por IP.
  if (email.length > 254 || senha.length > 200) return j(400, { erro:'E-mail ou senha incorretos.' });
  const user = await db.findUser(email.trim().toLowerCase());
  if (!user || !verifyPassword(senha, user.senha)) return j(401, { erro:'E-mail ou senha incorretos.' });
  if (isLegacyHash(user.senha)) await db.updateSenha(user.id, hashPassword(senha)); // reforça o hash de contas antigas de forma transparente
  const token = genToken();
  await db.createSession(token, user.id, Date.now() + SESSION_TTL_MS);
  return j(200, sessaoBody(token, user), { setSession: token });
}

export function config(): ServiceResult {
  return j(200, { googleClientId: env.GOOGLE_CLIENT_ID || null });
}

// Login com Google (Google Identity Services): o front manda o ID token assinado pelo
// Google e o servidor valida com o próprio Google (audiência, emissor, e-mail verificado)
// antes de criar a sessão. Se o e-mail ainda não tem conta, cria uma de morador.
export async function loginGoogle(ip: string, readBody: ReadBody): Promise<ServiceResult> {
  const db = await getDb();
  const clientId = env.GOOGLE_CLIENT_ID;
  if (!clientId) return j(404, { erro:'Login com Google não configurado.' });
  const rl = rateLimit('login:' + ip, 10, 15 * 60 * 1000);
  if (rl.limited) return j(429, { erro: `Muitas tentativas de login. Tente novamente em ${Math.ceil(rl.retryAfter!/60)} min.` });
  const { credential } = await readBody();
  if (typeof credential !== 'string' || !credential || credential.length > 4096) return j(400, { erro:'Credencial inválida.' });
  const info = await verificarTokenGoogle(credential);
  const emissorOk = info && (info.iss === 'accounts.google.com' || info.iss === 'https://accounts.google.com');
  if (!info || info.aud !== clientId || !emissorOk || String(info.email_verified) !== 'true' || !info.email || Number(info.exp) * 1000 < Date.now()) {
    return j(401, { erro:'Não foi possível validar sua conta Google.' });
  }
  const emailNorm = String(info.email).trim().toLowerCase();
  let user = await db.findUser(emailNorm);
  if (!user) {
    await db.createUser({ id:'u'+Date.now()+Math.random().toString(36).slice(2,7), nome:cap(String(info.name || emailNorm.split('@')[0]), 100), email:emailNorm, senha:hashPassword(crypto.randomBytes(32).toString('hex')), role:'morador', bairro:'', foto:null });
    user = await db.findUser(emailNorm);
  }
  if (!user) return j(500, { erro:'Erro interno do servidor.' });
  const token = genToken();
  await db.createSession(token, user.id, Date.now() + SESSION_TTL_MS);
  return j(200, sessaoBody(token, user), { setSession: token });
}

/** Apaga as sessões informadas (token do Bearer e/ou do cookie) e limpa o cookie. */
export async function logout(tokens: string[]): Promise<ServiceResult> {
  const db = await getDb();
  for (const t of new Set(tokens)) if (t) await db.deleteSession(t);
  return j(200, { ok:true }, { clearSession: true });
}

export function me(auth: Auth): ServiceResult {
  // No modo JSON o objeto do usuário guarda o hash do token de redefinição: nunca sai na resposta.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { senha, resetToken, resetExpiraEm, ...safe } = auth.user;
  const body = { ...safe, termosAceitos: !!auth.user.termosAceitosEm };
  // Migra quem já está logado só com o token no localStorage: grava o cookie na resposta.
  return j(200, body, auth.via === 'bearer' && auth.cookieToken !== auth.token ? { setSession: auth.token } : {});
}

export async function aceitarTermos(user: User): Promise<ServiceResult> {
  const db = await getDb();
  await db.aceitarTermos(user.id);
  return j(200, { ok:true });
}

export async function recuperarSenha(ip: string, baseUrl: string, readBody: ReadBody): Promise<ServiceResult> {
  const db = await getDb();
  const rl = rateLimit('recuperar:' + ip, 6, 60 * 60 * 1000);
  if (rl.limited) return j(429, { erro:'Muitas solicitações. Tente novamente mais tarde.' });
  const { email } = await readBody();
  const emailNorm = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const resposta: { ok: boolean; mensagem: string; tokenDemo?: string } = { ok:true, mensagem:'Se o e-mail existir em nossa base, enviaremos as instruções de redefinição.' };
  if (!emailNorm) return j(200, resposta);
  const user = await db.findUser(emailNorm);
  if (!user) return j(200, resposta);
  const tokenBruto = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(tokenBruto).digest('hex');
  const expiraEm = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await db.setResetToken(emailNorm, tokenHash, expiraEm);
  const linkRedefinicao = `${baseUrl}/?reset=${tokenBruto}`;
  // Ordem de prioridade: Gmail (não exige domínio próprio) > Resend (exige domínio
  // verificado para entregar a qualquer destinatário) > modo de demonstração.
  const temGmail = !!(env.GMAIL_USER && env.GMAIL_APP_PASSWORD);
  const temResend = !!env.RESEND_API_KEY;
  const usePostgres = isProdIntent();
  // Log incondicional a cada tentativa — assim dá pra ver nos logs exatamente qual caminho foi
  // tomado (Gmail, Resend ou nenhum configurado), mesmo quando dá certo.
  console.log(`[recuperar-senha] GMAIL_USER=${env.GMAIL_USER ? 'definido' : 'ausente'} GMAIL_APP_PASSWORD=${env.GMAIL_APP_PASSWORD ? 'definido' : 'ausente'} RESEND_API_KEY=${env.RESEND_API_KEY ? 'definido' : 'ausente'} usePostgres=${usePostgres}`);
  if (temGmail || temResend) {
    try {
      if (temGmail) await enviarEmailRecuperacaoGmail(emailNorm, linkRedefinicao);
      else await enviarEmailRecuperacaoResend(emailNorm, linkRedefinicao);
      console.log(`[recuperar-senha] E-mail enviado com sucesso via ${temGmail ? 'Gmail' : 'Resend'} para ${emailNorm}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`Falha ao enviar e-mail de recuperação via ${temGmail ? 'Gmail' : 'Resend'}:`, msg);
      console.log(`Token de redefinição de senha gerado para ${emailNorm} (falha no envio do e-mail): ${tokenBruto}`);
      if (!usePostgres || env.DEBUG_EXPOSE_RESET_TOKEN) {
        resposta.tokenDemo = tokenBruto;
        resposta.mensagem += ' (não foi possível enviar o e-mail agora; token incluído para fins de demonstração.)';
      }
    }
  } else if (!usePostgres || env.DEBUG_EXPOSE_RESET_TOKEN) {
    // Sem serviço de e-mail configurado. Para não vazar o token de redefinição em produção,
    // ele só é devolvido na resposta em modo de desenvolvimento (JSON local) ou se
    // DEBUG_EXPOSE_RESET_TOKEN estiver explicitamente definido (uso educacional/demonstração).
    console.log(`[recuperar-senha] Nenhum serviço de e-mail configurado — caiu no modo demonstração (usePostgres=${usePostgres}, DEBUG_EXPOSE_RESET_TOKEN=${!!env.DEBUG_EXPOSE_RESET_TOKEN}).`);
    resposta.tokenDemo = tokenBruto;
    resposta.mensagem += ' (modo demonstração: token incluído na resposta pois não há serviço de e-mail configurado.)';
  } else {
    console.log(`Token de redefinição de senha gerado para ${emailNorm} (envio de e-mail não configurado): ${tokenBruto}`);
  }
  return j(200, resposta);
}

export async function redefinirSenha(ip: string, readBody: ReadBody): Promise<ServiceResult> {
  const db = await getDb();
  const rl = rateLimit('redefinir:' + ip, 10, 60 * 60 * 1000);
  if (rl.limited) return j(429, { erro:'Muitas tentativas. Tente novamente mais tarde.' });
  const { token, senha } = await readBody();
  if (typeof token !== 'string' || !token.trim()) return j(400, { erro:'Token inválido.' });
  if (typeof senha !== 'string' || senha.length < 6) return j(400, { erro:'A nova senha precisa ter ao menos 6 caracteres.' });
  const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
  const user = await db.findUserByResetTokenHash(tokenHash);
  if (!user) return j(400, { erro:'Token inválido ou expirado. Solicite uma nova recuperação de senha.' });
  await db.updateSenha(user.id, hashPassword(senha));
  await db.clearResetToken(user.id);
  await db.deleteAllSessionsForUser(user.id);
  return j(200, { ok:true, mensagem:'Senha redefinida com sucesso. Faça login com a nova senha.' });
}
