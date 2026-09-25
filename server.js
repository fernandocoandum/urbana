const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const PORT = process.env.PORT || 3000;

// Presença de DATABASE_URL é tratada como "ambiente de produção": nesse modo, uma falha do
// Postgres NUNCA deve cair silenciosamente para o banco JSON local (que em hospedagem
// serverless sequer persiste entre execuções). Em vez disso, a API responde 503 até o banco
// voltar a ficar saudável.
const isProdIntent = !!process.env.DATABASE_URL;

let usePostgres = false;
let pool = null;
let dbReady = false; // true assim que o modo de persistência ativo (Postgres OU JSON local) está pronto para uso

async function initDB() {
  if (process.env.DATABASE_URL) {
    try {
      const { Pool } = require('pg');
      pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          nome TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          senha TEXT NOT NULL,
          role TEXT DEFAULT 'morador',
          bairro TEXT DEFAULT '',
          criado_em TIMESTAMPTZ DEFAULT NOW(),
          termos_aceitos_em TIMESTAMPTZ,
          foto TEXT
        );
        CREATE TABLE IF NOT EXISTS ocorrencias (
          id TEXT PRIMARY KEY,
          protocolo TEXT UNIQUE NOT NULL,
          user_id TEXT NOT NULL,
          titulo TEXT NOT NULL,
          descricao TEXT DEFAULT '',
          categoria TEXT NOT NULL,
          endereco TEXT NOT NULL,
          bairro TEXT NOT NULL,
          referencia TEXT DEFAULT '',
          foto TEXT,
          status TEXT DEFAULT 'Recebida',
          criado_em TIMESTAMPTZ DEFAULT NOW(),
          atualizado_em TIMESTAMPTZ DEFAULT NOW(),
          historico JSONB DEFAULT '[]',
          mensagens JSONB DEFAULT '[]',
          lat DOUBLE PRECISION,
          lng DOUBLE PRECISION,
          apoios JSONB DEFAULT '[]',
          avaliacao JSONB,
          precisao_local TEXT DEFAULT 'manual',
          responsavel TEXT,
          setor TEXT,
          prazo TIMESTAMPTZ,
          evidencia_resolucao TEXT,
          pedidos_reabertura JSONB DEFAULT '[]',
          admin_nao_lido BOOLEAN DEFAULT false,
          cidadao_nao_lido BOOLEAN DEFAULT false
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          criado_em TIMESTAMPTZ DEFAULT NOW(),
          expira_em TIMESTAMPTZ
        );
        CREATE TABLE IF NOT EXISTS config (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS chat_mensagens (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          nome TEXT NOT NULL,
          texto TEXT NOT NULL,
          criado_em TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS arquivos (
          id TEXT PRIMARY KEY,
          mime TEXT NOT NULL,
          dados TEXT NOT NULL,
          criado_em TIMESTAMPTZ DEFAULT NOW()
        );
        ALTER TABLE users ADD COLUMN IF NOT EXISTS termos_aceitos_em TIMESTAMPTZ;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS foto TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expira_em TIMESTAMPTZ;
        ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expira_em TIMESTAMPTZ;
        ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
        ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
        ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS apoios JSONB DEFAULT '[]';
        ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS avaliacao JSONB;
        ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS precisao_local TEXT DEFAULT 'manual';
        ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS responsavel TEXT;
        ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS setor TEXT;
        ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS prazo TIMESTAMPTZ;
        ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS evidencia_resolucao TEXT;
        ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS pedidos_reabertura JSONB DEFAULT '[]';
        ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS admin_nao_lido BOOLEAN DEFAULT false;
        ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS cidadao_nao_lido BOOLEAN DEFAULT false;
      `);
      usePostgres = true;
      await ensureApoiosTable();
      await ensureAdminAccount();
      await pool.query(`INSERT INTO config (key,value) VALUES ('next_protocolo','4') ON CONFLICT (key) DO NOTHING`);
      await seedExamples();
      dbReady = true;
      console.log('Banco PostgreSQL conectado');
    } catch (e) {
      // Em produção (DATABASE_URL configurado), uma falha do Postgres NÃO deve fazer o
      // servidor cair silenciosamente para persistência JSON local — em hospedagem serverless
      // o disco não é confiável entre execuções, e o operador precisa saber que o banco está
      // fora do ar em vez de o sistema "funcionar" perdendo dados sem avisar.
      usePostgres = true; // mantém a intenção de produção
      dbReady = false;
      console.error('ERRO CRÍTICO: falha ao conectar/inicializar o PostgreSQL:', e.message);
      console.error('O servidor está de pé, mas a API responderá 503 até o banco voltar a ficar saudável.');
    }
  } else {
    console.log('Usando banco JSON local (db.json) — modo de desenvolvimento, não recomendado em produção.');
    initJsonDB();
    await ensureAdminAccount();
    dbReady = true;
  }
}

// Cria a conta administrativa inicial sem depender de uma credencial fixa e conhecida.
// - ADMIN_EMAIL / ADMIN_SENHA (variáveis de ambiente) definem a credencial desejada.
// - Se ADMIN_SENHA for definida, ela é aplicada mesmo que a conta já exista — permite
//   girar a senha em produção só trocando a variável de ambiente e reiniciando/reimplantando.
// - Se não houver ADMIN_SENHA e a conta ainda não existir: em produção gera uma senha
//   aleatória forte (mostrada uma única vez no log); em desenvolvimento local (JSON) usa
//   "admin" por conveniência, deixando claro que é só para uso local.
async function ensureAdminAccount() {
  const email = (process.env.ADMIN_EMAIL || 'admin@prefeitura.gov.br').trim().toLowerCase();
  const nome = process.env.ADMIN_NOME || 'Admin Prefeitura';
  const senhaEnv = process.env.ADMIN_SENHA;
  let existente = usePostgres
    ? (await pool.query('SELECT id FROM users WHERE email=$1', [email])).rows[0]
    : jsonDB.users.find(u => u.email === email);

  if (senhaEnv) {
    const hash = hashPassword(senhaEnv);
    if (existente) {
      if (usePostgres) await pool.query('UPDATE users SET senha=$1 WHERE email=$2', [hash, email]);
      else { existente.senha = hash; saveJsonDB(); }
      console.log(`Senha da conta administrativa (${email}) sincronizada com ADMIN_SENHA.`);
    } else {
      const novo = { id:'u1', nome, email, senha:hash, role:'admin', bairro:'', foto:null };
      if (usePostgres) await pool.query('INSERT INTO users (id,nome,email,senha,role,termos_aceitos_em) VALUES ($1,$2,$3,$4,$5,NOW())', [novo.id, novo.nome, novo.email, novo.senha, novo.role]);
      else { novo.criadoEm = new Date().toISOString(); novo.termosAceitosEm = novo.criadoEm; jsonDB.users.push(novo); saveJsonDB(); }
      console.log(`Conta administrativa criada: ${email} (senha definida por ADMIN_SENHA).`);
    }
    return;
  }

  if (existente) return; // conta já existe e nenhuma senha nova foi solicitada — não mexe nela

  const senhaGerada = isProdIntent ? crypto.randomBytes(9).toString('base64url') : 'admin';
  const hash = hashPassword(senhaGerada);
  const novo = { id:'u1', nome, email, senha:hash, role:'admin', bairro:'', foto:null };
  if (usePostgres) await pool.query('INSERT INTO users (id,nome,email,senha,role,termos_aceitos_em) VALUES ($1,$2,$3,$4,$5,NOW())', [novo.id, novo.nome, novo.email, novo.senha, novo.role]);
  else { novo.criadoEm = new Date().toISOString(); novo.termosAceitosEm = novo.criadoEm; jsonDB.users.push(novo); saveJsonDB(); }

  if (isProdIntent) {
    console.log('========================================================');
    console.log(`Conta administrativa criada automaticamente: ${email}`);
    console.log(`Senha temporária gerada (defina ADMIN_SENHA para fixar uma própria): ${senhaGerada}`);
    console.log('Troque essa senha assim que possível (ou defina ADMIN_SENHA e reimplante).');
    console.log('========================================================');
  } else {
    console.log(`Modo de desenvolvimento: conta administrativa ${email} / senha "admin" (apenas local).`);
  }
}

async function ensureApoiosTable() {
  // Tabela normalizada de apoios com unicidade (ocorrencia,usuário) — evita leitura+gravação
  // do array inteiro de apoios sob concorrência, que pode perder incrementos simultâneos.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS apoios_registro (
      ocorrencia_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      criado_em TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (ocorrencia_id, user_id)
    );
  `);
  // Migra apoios já armazenados no array JSONB legado, se houver, para a tabela normalizada.
  const r = await pool.query(`SELECT id, apoios FROM ocorrencias WHERE apoios IS NOT NULL AND jsonb_array_length(apoios) > 0`);
  for (const row of r.rows) {
    for (const uid of row.apoios) {
      await pool.query('INSERT INTO apoios_registro (ocorrencia_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [row.id, uid]);
    }
  }
}

async function seedExamples() {
  const count = await pool.query('SELECT COUNT(*) FROM ocorrencias');
  if (parseInt(count.rows[0].count) > 0) return;
  const examples = [
    ['oc1','PROT-2026-0001','u1','Buraco na Rua João Machado','Buraco de aproximadamente 80cm de diâmetro na pista principal.','Pavimentação','Rua João Machado, 450','Centro','Em frente à padaria Pão de Mel','Em atendimento','2026-01-02T14:32:00Z',
      JSON.stringify([{status:'Recebida',data:'2026-01-02T14:32:00Z',obs:'Registrada pelo cidadão'},{status:'Em análise',data:'2026-01-03T09:15:00Z',obs:'Avaliação técnica iniciada'},{status:'Encaminhada',data:'2026-01-03T16:48:00Z',obs:'Encaminhada para Secretaria de Obras'},{status:'Em atendimento',data:'2026-01-05T08:00:00Z',obs:'Equipe de campo em ação'}]), -28.2761, -49.1712],
    ['oc2','PROT-2026-0002','u1','Poste sem iluminação — Av. Principal','Poste apagado há mais de uma semana.','Iluminação pública','Av. Principal, 1200','Centro','Próximo ao Banco do Brasil','Em análise','2026-01-05T10:00:00Z',
      JSON.stringify([{status:'Recebida',data:'2026-01-05T10:00:00Z',obs:'Registrada'},{status:'Em análise',data:'2026-01-06T09:00:00Z',obs:'Verificação técnica agendada'}]), -28.2745, -49.1698],
    ['oc3','PROT-2026-0003','u1','Descarte irregular — Loteamento Santa Clara','Lixo e entulho descartados irregularmente.','Limpeza urbana','Estrada Santa Clara, s/n','Santa Clara','Ao lado da Escola Municipal','Resolvida','2025-12-15T09:00:00Z',
      JSON.stringify([{status:'Recebida',data:'2025-12-15T09:00:00Z',obs:'Registrada'},{status:'Em análise',data:'2025-12-16T10:00:00Z',obs:'Vistoria realizada'},{status:'Em atendimento',data:'2025-12-18T08:00:00Z',obs:'Equipe de limpeza acionada'},{status:'Resolvida',data:'2025-12-20T16:00:00Z',obs:'Área limpa e desobstruída'}]), -28.2815, -49.1655]
  ];
  for (const [id,protocolo,user_id,titulo,descricao,categoria,endereco,bairro,referencia,status,criado_em,historico,lat,lng] of examples) {
    await pool.query(`INSERT INTO ocorrencias (id,protocolo,user_id,titulo,descricao,categoria,endereco,bairro,referencia,status,criado_em,atualizado_em,historico,lat,lng) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12,$13,$14) ON CONFLICT DO NOTHING`,
      [id,protocolo,user_id,titulo,descricao,categoria,endereco,bairro,referencia,status,criado_em,historico,lat,lng]);
  }
  await pool.query(`UPDATE config SET value='4' WHERE key='next_protocolo'`);
}

const DB_FILE = path.join(__dirname, 'db.json');
let jsonDB = null;

function initJsonDB() {
  if (fs.existsSync(DB_FILE)) {
    try {
      jsonDB = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (!jsonDB.chatMensagens) jsonDB.chatMensagens = [];
      if (!jsonDB.arquivos) jsonDB.arquivos = [];
      if (!jsonDB.users) jsonDB.users = [];
      return;
    } catch {}
  }
  jsonDB = {
    users: [],
    ocorrencias: [
      { id:'oc1', protocolo:'PROT-2026-0001', userId:'u1', titulo:'Buraco na Rua João Machado', descricao:'Buraco de aproximadamente 80cm de diâmetro na pista principal.', categoria:'Pavimentação', endereco:'Rua João Machado, 450', bairro:'Centro', referencia:'Em frente à padaria Pão de Mel', foto:null, status:'Em atendimento', criadoEm:'2026-01-02T14:32:00.000Z', atualizadoEm:'2026-01-05T08:00:00.000Z', historico:[{status:'Recebida',data:'2026-01-02T14:32:00.000Z',obs:'Registrada pelo cidadão'},{status:'Em análise',data:'2026-01-03T09:15:00.000Z',obs:'Avaliação técnica iniciada'},{status:'Encaminhada',data:'2026-01-03T16:48:00.000Z',obs:'Encaminhada para Secretaria de Obras'},{status:'Em atendimento',data:'2026-01-05T08:00:00.000Z',obs:'Equipe de campo em ação'}], mensagens:[], lat:-28.2761, lng:-49.1712, apoios:[], avaliacao:null },
      { id:'oc2', protocolo:'PROT-2026-0002', userId:'u1', titulo:'Poste sem iluminação — Av. Principal', descricao:'Poste apagado há mais de uma semana.', categoria:'Iluminação pública', endereco:'Av. Principal, 1200', bairro:'Centro', referencia:'Próximo ao Banco do Brasil', foto:null, status:'Em análise', criadoEm:'2026-01-05T10:00:00.000Z', atualizadoEm:'2026-01-06T09:00:00.000Z', historico:[{status:'Recebida',data:'2026-01-05T10:00:00.000Z',obs:'Registrada'},{status:'Em análise',data:'2026-01-06T09:00:00.000Z',obs:'Verificação agendada'}], mensagens:[], lat:-28.2745, lng:-49.1698, apoios:[], avaliacao:null },
      { id:'oc3', protocolo:'PROT-2026-0003', userId:'u1', titulo:'Descarte irregular — Santa Clara', descricao:'Lixo e entulho descartados irregularmente.', categoria:'Limpeza urbana', endereco:'Estrada Santa Clara, s/n', bairro:'Santa Clara', referencia:'Ao lado da Escola Municipal', foto:null, status:'Resolvida', criadoEm:'2025-12-15T09:00:00.000Z', atualizadoEm:'2025-12-20T16:00:00.000Z', historico:[{status:'Recebida',data:'2025-12-15T09:00:00.000Z',obs:'Registrada'},{status:'Resolvida',data:'2025-12-20T16:00:00.000Z',obs:'Área limpa'}], mensagens:[], lat:-28.2815, lng:-49.1655, apoios:[], avaliacao:{nota:5,comentario:'Ficou ótimo, rápido demais!',data:'2025-12-21T10:00:00.000Z'} }
    ],
    sessions: {},
    nextProtocolo: 4,
    chatMensagens: [],
    arquivos: []
  };
  saveJsonDB();
}

function saveJsonDB() {
  // Propositalmente sem try/catch: uma falha de gravação (disco cheio, permissão, etc.) deve
  // estourar e ser tratada como erro pelo handler da rota (500), nunca ser engolida em
  // silêncio fingindo que o dado foi persistido.
  fs.writeFileSync(DB_FILE, JSON.stringify(jsonDB, null, 2));
}

function genToken() { return crypto.randomBytes(32).toString('hex'); }

// --- Senhas: scrypt com salt por usuário, com verificação de contas antigas (sha256 sem salt) ---
function hashPassword(senha) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(senha, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}
function verifyPassword(senha, armazenado) {
  if (!armazenado || typeof senha !== 'string') return false;
  if (armazenado.startsWith('scrypt:')) {
    const [, salt, derivedHex] = armazenado.split(':');
    if (!salt || !derivedHex) return false;
    const stored = Buffer.from(derivedHex, 'hex');
    const test = crypto.scryptSync(senha, salt, stored.length);
    return stored.length === test.length && crypto.timingSafeEqual(stored, test);
  }
  // Compatibilidade com contas criadas antes do reforço de segurança (sha256 sem salt)
  const legacy = Buffer.from(crypto.createHash('sha256').update(senha).digest('hex'), 'hex');
  const stored = Buffer.from(armazenado, 'hex');
  return legacy.length === stored.length && crypto.timingSafeEqual(legacy, stored);
}
function isLegacyHash(armazenado) { return !!armazenado && !armazenado.startsWith('scrypt:'); }

// --- Rate limiting simples em memória (por IP), protege contra força bruta e abuso ---
const rateLimitStore = new Map();
function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || 'desconhecido';
}
function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  if (rateLimitStore.size > 10000) {
    for (const [k, v] of rateLimitStore) if (now > v.resetAt) rateLimitStore.delete(k);
  }
  let entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitStore.set(key, entry);
  }
  entry.count++;
  if (entry.count > limit) return { limited: true, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  return { limited: false };
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

// --- Validação de arquivos enviados pelo usuário (fotos) ---
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
// Confere os bytes mágicos reais do arquivo contra o MIME declarado — um base64 arbitrário
// rotulado "image/png" não passa mais por causa de um Content-Type de confiança.
function assinaturaImagemValida(mime, buffer) {
  if (buffer.length < 12) return false;
  const b = buffer;
  if (mime === 'image/png') {
    return b[0]===0x89 && b[1]===0x50 && b[2]===0x4E && b[3]===0x47 && b[4]===0x0D && b[5]===0x0A && b[6]===0x1A && b[7]===0x0A;
  }
  if (mime === 'image/jpeg') {
    return b[0]===0xFF && b[1]===0xD8 && b[2]===0xFF;
  }
  if (mime === 'image/gif') {
    const header = b.slice(0,6).toString('ascii');
    return header === 'GIF87a' || header === 'GIF89a';
  }
  if (mime === 'image/webp') {
    return b.slice(0,4).toString('ascii') === 'RIFF' && b.slice(8,12).toString('ascii') === 'WEBP';
  }
  return false;
}
// Proxy simples para o Nominatim (geocodificação, direta e reversa): evita que o cliente
// chame o serviço diretamente, o que violaria a CSP (connect-src 'self') e exporia a chave
// de referer do site.
function nominatimRequest(pathAndQuery) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'nominatim.openstreetmap.org',
      path: pathAndQuery,
      method: 'GET',
      headers: { 'User-Agent': 'UrbanaBracoDoNorte/1.0 (contato: prefeitura)', 'Accept-Language': 'pt-BR' },
      timeout: 8000
    };
    const req = https.request(options, (resp) => {
      let dataStr = '';
      resp.on('data', (chunk) => { dataStr += chunk; if (dataStr.length > 1_000_000) req.destroy(); });
      resp.on('end', () => {
        try { resolve(JSON.parse(dataStr)); } catch { reject(new Error('Resposta inválida do serviço de geocodificação.')); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('Tempo esgotado ao consultar geocodificação.')));
    req.on('error', reject);
    req.end();
  });
}
function geocodeNominatim(query) {
  const qs = new URLSearchParams({ q: query, format: 'json', limit: '5', countrycodes: 'br' });
  return nominatimRequest('/search?' + qs.toString());
}
function reverseGeocodeNominatim(lat, lng) {
  const qs = new URLSearchParams({ format: 'json', lat: String(lat), lon: String(lng), zoom: '18', addressdetails: '1' });
  return nominatimRequest('/reverse?' + qs.toString());
}
// Envio real do e-mail de recuperação de senha. Duas formas são suportadas, nenhuma delas
// com credenciais fixas no código — tudo vem de variáveis de ambiente definidas na hospedagem
// (ex.: Vercel). Sem nenhuma das duas configuradas, o fluxo cai no modo de demonstração
// (token exibido na resposta), como antes.
//   1) Gmail (GMAIL_USER + GMAIL_APP_PASSWORD): manda pelo SMTP do Gmail com uma "senha de app"
//      — não exige domínio próprio, funciona com qualquer conta @gmail.com. Tem prioridade
//      porque não depende de verificar domínio.
//   2) Resend (RESEND_API_KEY): serviço transacional dedicado; exige verificar um domínio
//      próprio para enviar a qualquer destinatário (sem isso, só entrega para o e-mail da
//      própria conta Resend).
function htmlEmailRecuperacao(link) {
  return `<div style="font-family:sans-serif;font-size:14px;color:#1f2937;line-height:1.6">
    <p>Olá,</p>
    <p>Recebemos um pedido para redefinir a senha da sua conta no <strong>Urbana</strong>, o sistema de ocorrências urbanas de Braço do Norte.</p>
    <p><a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:100px;font-weight:600">Criar nova senha</a></p>
    <p style="font-size:12px;color:#6b7280">Ou copie e cole este link no navegador:<br>${link}</p>
    <p style="font-size:12px;color:#6b7280">Este link expira em 1 hora. Se você não solicitou essa alteração, pode ignorar este e-mail com segurança.</p>
  </div>`;
}
let gmailTransporter = null;
function obterTransportadorGmail() {
  if (!gmailTransporter) {
    // O Google mostra a senha de app com espaços (ex.: "abcd efgh ijkl mnop") só para
    // facilitar a leitura — a credencial real são as 16 letras sem espaço nenhum. Removemos
    // qualquer espaço aqui para não falhar silenciosamente se alguém colar com espaços na
    // variável de ambiente.
    const gmailUser = (process.env.GMAIL_USER || '').trim();
    const gmailPass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
    gmailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
      // Timeouts curtos: se o SMTP do Gmail ficar inacessível (rede, credencial revogada etc.),
      // falha rápido e cai no fallback em vez de travar a requisição esperando indefinidamente.
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000
    });
  }
  return gmailTransporter;
}
function enviarEmailRecuperacaoGmail(destinatario, link) {
  const transportador = obterTransportadorGmail();
  return transportador.sendMail({
    from: `"Urbana" <${process.env.GMAIL_USER}>`,
    to: destinatario,
    subject: 'Recuperação de senha - Urbana',
    html: htmlEmailRecuperacao(link)
  });
}
function enviarEmailRecuperacaoResend(destinatario, link) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return reject(new Error('RESEND_API_KEY não configurada.'));
    const payload = JSON.stringify({
      from: process.env.RESEND_FROM || 'Urbana <onboarding@resend.dev>',
      to: [destinatario],
      subject: 'Recuperação de senha - Urbana',
      html: htmlEmailRecuperacao(link)
    });
    const options = {
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 8000
    };
    const reqResend = https.request(options, (resp) => {
      let dataStr = '';
      resp.on('data', (chunk) => { dataStr += chunk; });
      resp.on('end', () => {
        if (resp.statusCode >= 200 && resp.statusCode < 300) resolve(true);
        else reject(new Error(`Resend respondeu ${resp.statusCode}: ${dataStr.slice(0, 300)}`));
      });
    });
    reqResend.on('timeout', () => reqResend.destroy(new Error('Tempo esgotado ao enviar e-mail de recuperação.')));
    reqResend.on('error', reject);
    reqResend.write(payload);
    reqResend.end();
  });
}
function baseUrlFromReq(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  const proto = req.headers['x-forwarded-proto'] || (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
  return `${proto}://${host}`;
}
function isOwnUploadUrl(v) { return v === null || v === undefined || /^\/api\/arquivos\/[A-Za-z0-9]+$/.test(v); }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function cap(str, max) { return typeof str === 'string' ? str.trim().slice(0, max) : str; }
const CATEGORIAS_VALIDAS = new Set(['Pavimentação','Iluminação pública','Limpeza urbana','Sinalização','Drenagem / Bueiro','Parques e jardins','Outros']);
const BAIRROS_VALIDOS = new Set(['Centro','Pinheiral','Baixo Pinheiral','São Maurício','Rio Glória','Santa Clara','Outro']);
const STATUS_VALIDOS = new Set(['Recebida','Em análise','Encaminhada','Em atendimento','Resolvida']);
const STATUS_ORDEM = ['Recebida','Em análise','Encaminhada','Em atendimento','Resolvida'];

function isCoordenadaValida(lat, lng) {
  return typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function anoAtualBR() {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric' }).format(new Date());
}

async function gerarProtocolo() {
  const ano = anoAtualBR();
  if (usePostgres) {
    const r = await pool.query(`UPDATE config SET value=(value::int+1)::text WHERE key='next_protocolo' RETURNING value`);
    const n = String(parseInt(r.rows[0].value) - 1).padStart(4,'0');
    return `PROT-${ano}-${n}`;
  }
  const n = String(jsonDB.nextProtocolo).padStart(4,'0');
  jsonDB.nextProtocolo++;
  saveJsonDB();
  return `PROT-${ano}-${n}`;
}

// Campos derivados (não armazenados): atraso e uma pontuação simples de criticidade, usados
// pela fila de atendimento administrativa para ordenar além da contagem de apoios.
function computeDerivedFields(o) {
  const agora = Date.now();
  const prazoTs = o.prazo ? new Date(o.prazo).getTime() : null;
  const atrasada = !!(prazoTs && o.status !== 'Resolvida' && agora > prazoTs);
  const diasAberto = Math.max(0, Math.floor((agora - new Date(o.criadoEm).getTime()) / 86400000));
  const apoiosCount = (o.apoios || []).length;
  const criticidade = apoiosCount * 3 + Math.min(diasAberto, 30) + (atrasada ? 15 : 0);
  return { ...o, atrasada, diasAberto, criticidade };
}

function mapOcorrenciaPg(o, apoios) {
  return computeDerivedFields({
    id:o.id, protocolo:o.protocolo, userId:o.user_id, titulo:o.titulo, descricao:o.descricao,
    categoria:o.categoria, endereco:o.endereco, bairro:o.bairro, referencia:o.referencia,
    foto:o.foto, status:o.status, criadoEm:o.criado_em, atualizadoEm:o.atualizado_em,
    historico:o.historico||[], mensagens:o.mensagens||[], nomeUsuario:o.nome_usuario||'–',
    lat:o.lat, lng:o.lng, apoios, avaliacao:o.avaliacao||null,
    precisaoLocal: o.precisao_local || 'manual',
    responsavel: o.responsavel || null,
    setor: o.setor || null,
    prazo: o.prazo || null,
    evidenciaResolucao: o.evidencia_resolucao || null,
    pedidosReabertura: o.pedidos_reabertura || [],
    naoLidoAdmin: !!o.admin_nao_lido,
    naoLidoCidadao: !!o.cidadao_nao_lido
  });
}

async function getApoiosMap(ids) {
  if (!ids.length) return {};
  const r = await pool.query('SELECT ocorrencia_id, user_id FROM apoios_registro WHERE ocorrencia_id = ANY($1)', [ids]);
  const map = {};
  for (const row of r.rows) { (map[row.ocorrencia_id] = map[row.ocorrencia_id] || []).push(row.user_id); }
  return map;
}

const db = {
  async findUser(email) {
    if (usePostgres) {
      const r = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
      if (!r.rows[0]) return null;
      const u = r.rows[0];
      return { id:u.id, nome:u.nome, email:u.email, senha:u.senha, role:u.role, bairro:u.bairro, termosAceitosEm:u.termos_aceitos_em, foto:u.foto };
    }
    return jsonDB.users.find(u => u.email === email) || null;
  },
  async findUserById(id) {
    if (usePostgres) {
      const r = await pool.query('SELECT * FROM users WHERE id=$1', [id]);
      if (!r.rows[0]) return null;
      const u = r.rows[0];
      return { id:u.id, nome:u.nome, email:u.email, senha:u.senha, role:u.role, bairro:u.bairro, termosAceitosEm:u.termos_aceitos_em, foto:u.foto };
    }
    return jsonDB.users.find(u => u.id === id) || null;
  },
  async setResetToken(email, tokenHash, expiraEm) {
    if (usePostgres) {
      await pool.query('UPDATE users SET reset_token=$1, reset_expira_em=$2 WHERE email=$3', [tokenHash, expiraEm, email]);
      return;
    }
    const u = jsonDB.users.find(u => u.email === email);
    if (u) { u.resetToken = tokenHash; u.resetExpiraEm = expiraEm; saveJsonDB(); }
  },
  async findUserByResetTokenHash(tokenHash) {
    const agora = Date.now();
    if (usePostgres) {
      const r = await pool.query('SELECT * FROM users WHERE reset_token=$1', [tokenHash]);
      const u = r.rows[0];
      if (!u || !u.reset_expira_em || new Date(u.reset_expira_em).getTime() < agora) return null;
      return { id:u.id, nome:u.nome, email:u.email };
    }
    const u = jsonDB.users.find(u => u.resetToken === tokenHash);
    if (!u || !u.resetExpiraEm || new Date(u.resetExpiraEm).getTime() < agora) return null;
    return { id:u.id, nome:u.nome, email:u.email };
  },
  async clearResetToken(userId) {
    if (usePostgres) {
      await pool.query('UPDATE users SET reset_token=NULL, reset_expira_em=NULL WHERE id=$1', [userId]);
      return;
    }
    const u = jsonDB.users.find(u => u.id === userId);
    if (u) { u.resetToken = null; u.resetExpiraEm = null; saveJsonDB(); }
  },
  async deleteAllSessionsForUser(userId) {
    if (usePostgres) {
      await pool.query('DELETE FROM sessions WHERE user_id=$1', [userId]);
      return;
    }
    for (const t of Object.keys(jsonDB.sessions)) {
      if (jsonDB.sessions[t].userId === userId) delete jsonDB.sessions[t];
    }
    saveJsonDB();
  },
  async updatePerfil(userId, { nome, foto }) {
    if (usePostgres) {
      if (nome !== undefined && foto !== undefined) {
        await pool.query('UPDATE users SET nome=$1, foto=$2 WHERE id=$3', [nome, foto, userId]);
      } else if (nome !== undefined) {
        await pool.query('UPDATE users SET nome=$1 WHERE id=$2', [nome, userId]);
      } else if (foto !== undefined) {
        await pool.query('UPDATE users SET foto=$1 WHERE id=$2', [foto, userId]);
      }
      return;
    }
    const u = jsonDB.users.find(u => u.id === userId);
    if (!u) return;
    if (nome !== undefined) u.nome = nome;
    if (foto !== undefined) u.foto = foto;
    saveJsonDB();
  },
  async contarApoiosDados(userId) {
    if (usePostgres) {
      const r = await pool.query('SELECT COUNT(*) FROM apoios_registro WHERE user_id=$1', [userId]);
      return parseInt(r.rows[0].count);
    }
    return jsonDB.ocorrencias.filter(o => (o.apoios||[]).includes(userId)).length;
  },
  async createUser(user) {
    if (usePostgres) {
      await pool.query('INSERT INTO users (id,nome,email,senha,role,bairro) VALUES ($1,$2,$3,$4,$5,$6)',
        [user.id, user.nome, user.email, user.senha, user.role, user.bairro]);
      return;
    }
    jsonDB.users.push(user); saveJsonDB();
  },
  async aceitarTermos(userId) {
    const agora = new Date().toISOString();
    if (usePostgres) {
      await pool.query('UPDATE users SET termos_aceitos_em=$1 WHERE id=$2', [agora, userId]);
      return;
    }
    const u = jsonDB.users.find(u => u.id === userId);
    if (u) { u.termosAceitosEm = agora; saveJsonDB(); }
  },
  async emailExists(email) {
    if (usePostgres) {
      const r = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
      return r.rows.length > 0;
    }
    return jsonDB.users.some(u => u.email === email);
  },
  async createSession(token, userId, expiresAt) {
    if (usePostgres) {
      await pool.query('INSERT INTO sessions (token,user_id,expira_em) VALUES ($1,$2,$3)', [token, userId, expiresAt ? new Date(expiresAt) : null]);
      return;
    }
    jsonDB.sessions[token] = { userId, expiresAt: expiresAt || null }; saveJsonDB();
  },
  async getSession(token) {
    if (usePostgres) {
      const r = await pool.query('SELECT user_id, expira_em FROM sessions WHERE token=$1', [token]);
      if (!r.rows[0]) return null;
      if (r.rows[0].expira_em && new Date(r.rows[0].expira_em).getTime() < Date.now()) {
        await pool.query('DELETE FROM sessions WHERE token=$1', [token]);
        return null;
      }
      return { userId: r.rows[0].user_id };
    }
    const s = jsonDB.sessions[token];
    if (!s) return null;
    if (s.expiresAt && s.expiresAt < Date.now()) {
      delete jsonDB.sessions[token]; saveJsonDB();
      return null;
    }
    return s;
  },
  async deleteSession(token) {
    if (usePostgres) {
      await pool.query('DELETE FROM sessions WHERE token=$1', [token]); return;
    }
    delete jsonDB.sessions[token]; saveJsonDB();
  },
  async updateSenha(userId, novoHash) {
    if (usePostgres) {
      await pool.query('UPDATE users SET senha=$1 WHERE id=$2', [novoHash, userId]);
      return;
    }
    const u = jsonDB.users.find(u => u.id === userId);
    if (u) { u.senha = novoHash; saveJsonDB(); }
  },
  async listOcorrencias(filters = {}) {
    if (usePostgres) {
      let q = `SELECT o.*, u.nome as nome_usuario FROM ocorrencias o LEFT JOIN users u ON o.user_id=u.id WHERE 1=1`;
      const params = [];
      if (filters.userId) { params.push(filters.userId); q += ` AND o.user_id=$${params.length}`; }
      if (filters.status && filters.status !== 'todos') { params.push(filters.status); q += ` AND o.status=$${params.length}`; }
      if (filters.categoria && filters.categoria !== 'todas') { params.push(filters.categoria); q += ` AND o.categoria=$${params.length}`; }
      if (filters.bairro && filters.bairro !== 'todos') { params.push(filters.bairro); q += ` AND o.bairro=$${params.length}`; }
      if (filters.busca) { params.push(`%${filters.busca}%`); q += ` AND (o.protocolo ILIKE $${params.length} OR o.titulo ILIKE $${params.length} OR o.bairro ILIKE $${params.length})`; }
      q += ' ORDER BY o.criado_em DESC';
      const r = await pool.query(q, params);
      const apoiosPorOc = await getApoiosMap(r.rows.map(o => o.id));
      return r.rows.map(o => mapOcorrenciaPg(o, apoiosPorOc[o.id] || []));
    }
    let lista = jsonDB.ocorrencias.map(o => {
      const u = jsonDB.users.find(u => u.id === o.userId);
      return { ...o, nomeUsuario: u?.nome || '–' };
    });
    if (filters.userId) lista = lista.filter(o => o.userId === filters.userId);
    if (filters.status && filters.status !== 'todos') lista = lista.filter(o => o.status === filters.status);
    if (filters.categoria && filters.categoria !== 'todas') lista = lista.filter(o => o.categoria === filters.categoria);
    if (filters.bairro && filters.bairro !== 'todos') lista = lista.filter(o => o.bairro === filters.bairro);
    if (filters.busca) { const b = filters.busca.toLowerCase(); lista = lista.filter(o => o.protocolo.toLowerCase().includes(b)||o.titulo.toLowerCase().includes(b)||o.bairro.toLowerCase().includes(b)); }
    return lista.sort((a,b) => new Date(b.criadoEm)-new Date(a.criadoEm)).map(computeDerivedFields);
  },
  async getOcorrencia(id) {
    if (usePostgres) {
      const r = await pool.query(`SELECT o.*, u.nome as nome_usuario FROM ocorrencias o LEFT JOIN users u ON o.user_id=u.id WHERE o.id=$1`, [id]);
      if (!r.rows[0]) return null;
      const apoios = (await pool.query('SELECT user_id FROM apoios_registro WHERE ocorrencia_id=$1', [id])).rows.map(x => x.user_id);
      return mapOcorrenciaPg(r.rows[0], apoios);
    }
    const o = jsonDB.ocorrencias.find(o => o.id === id);
    if (!o) return null;
    const u = jsonDB.users.find(u => u.id === o.userId);
    return computeDerivedFields({ ...o, nomeUsuario: u?.nome || '–' });
  },
  async createOcorrencia(oc) {
    if (usePostgres) {
      await pool.query(`INSERT INTO ocorrencias (id,protocolo,user_id,titulo,descricao,categoria,endereco,bairro,referencia,foto,status,criado_em,atualizado_em,historico,mensagens,lat,lng,precisao_local,responsavel,setor,prazo,evidencia_resolucao,pedidos_reabertura) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
        [oc.id, oc.protocolo, oc.userId, oc.titulo, oc.descricao, oc.categoria, oc.endereco, oc.bairro, oc.referencia, oc.foto, oc.status, oc.criadoEm, JSON.stringify(oc.historico), JSON.stringify(oc.mensagens), oc.lat ?? null, oc.lng ?? null, oc.precisaoLocal || 'manual', oc.responsavel || null, oc.setor || null, oc.prazo || null, oc.evidenciaResolucao || null, JSON.stringify(oc.pedidosReabertura || [])]);
      return;
    }
    jsonDB.ocorrencias.push(oc); saveJsonDB();
  },
  async toggleApoio(id, userId) {
    if (usePostgres) {
      // Constraint de unicidade (ocorrencia_id,user_id) evita duplicar apoio mesmo sob concorrência.
      const existing = await pool.query('SELECT 1 FROM apoios_registro WHERE ocorrencia_id=$1 AND user_id=$2', [id, userId]);
      const jaApoiava = existing.rows.length > 0;
      if (jaApoiava) await pool.query('DELETE FROM apoios_registro WHERE ocorrencia_id=$1 AND user_id=$2', [id, userId]);
      else await pool.query('INSERT INTO apoios_registro (ocorrencia_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, userId]);
      const total = await pool.query('SELECT COUNT(*) FROM apoios_registro WHERE ocorrencia_id=$1', [id]);
      return { apoiado: !jaApoiava, total: parseInt(total.rows[0].count) };
    }
    const oc = jsonDB.ocorrencias.find(o => o.id === id);
    if (!oc) return null;
    if (!oc.apoios) oc.apoios = [];
    const already = oc.apoios.includes(userId);
    oc.apoios = already ? oc.apoios.filter(u => u !== userId) : [...oc.apoios, userId];
    saveJsonDB();
    return { apoiado: !already, total: oc.apoios.length };
  },
  async avaliar(id, nota, comentario) {
    const agora = new Date().toISOString();
    const avaliacao = { nota, comentario: comentario || '', data: agora };
    if (usePostgres) {
      const r = await pool.query('UPDATE ocorrencias SET avaliacao=$1 WHERE id=$2 RETURNING id', [JSON.stringify(avaliacao), id]);
      return r.rows[0] ? avaliacao : null;
    }
    const oc = jsonDB.ocorrencias.find(o => o.id === id);
    if (!oc) return null;
    oc.avaliacao = avaliacao;
    saveJsonDB();
    return avaliacao;
  },
  // opts: { obs, setor, responsavel, prazo, evidencia, tipoEvento }. Mensagens não passam
  // mais por aqui — ver addMensagem(), que é uma rota própria e nunca mexe em status.
  async updateStatus(id, status, opts = {}) {
    const { obs, setor, responsavel, prazo, evidencia, tipoEvento } = opts;
    const agora = new Date().toISOString();
    const histEntry = { status, data: agora, obs: obs || `Status alterado para ${status}`, setor: setor || null };
    if (tipoEvento) histEntry.tipo = tipoEvento; // ex.: 'reabertura', para diferenciar na linha do tempo
    if (usePostgres) {
      const r = await pool.query('SELECT historico, status, evidencia_resolucao FROM ocorrencias WHERE id=$1', [id]);
      if (!r.rows[0]) return false;
      const hist = r.rows[0].historico || [];
      hist.push(histEntry);
      const sets = ['status=$1', 'atualizado_em=$2', 'historico=$3'];
      const params = [status, agora, JSON.stringify(hist)];
      if (setor !== undefined) { params.push(setor); sets.push(`setor=$${params.length}`); }
      if (responsavel !== undefined) { params.push(responsavel); sets.push(`responsavel=$${params.length}`); }
      if (prazo !== undefined) { params.push(prazo); sets.push(`prazo=$${params.length}`); }
      if (status === 'Resolvida' && evidencia !== undefined) { params.push(evidencia); sets.push(`evidencia_resolucao=$${params.length}`); }
      params.push(id);
      await pool.query(`UPDATE ocorrencias SET ${sets.join(', ')} WHERE id=$${params.length}`, params);
      return true;
    }
    const idx = jsonDB.ocorrencias.findIndex(o => o.id === id);
    if (idx === -1) return false;
    const oc = jsonDB.ocorrencias[idx];
    oc.status = status;
    oc.atualizadoEm = agora;
    oc.historico.push(histEntry);
    if (setor !== undefined) oc.setor = setor;
    if (responsavel !== undefined) oc.responsavel = responsavel;
    if (prazo !== undefined) oc.prazo = prazo;
    if (status === 'Resolvida' && evidencia !== undefined) oc.evidenciaResolucao = evidencia;
    saveJsonDB();
    return true;
  },
  // Mensagens de acompanhamento, em uma conversa única por ocorrência. `de` é 'prefeitura' ou
  // 'cidadao'. Marca a ocorrência como não lida para o outro lado da conversa.
  async addMensagem(id, de, texto) {
    const agora = new Date().toISOString();
    const msg = { id:'msg'+Date.now()+Math.random().toString(36).slice(2,7), de, texto, data:agora };
    if (usePostgres) {
      const r = await pool.query('SELECT mensagens FROM ocorrencias WHERE id=$1', [id]);
      if (!r.rows[0]) return null;
      const msgs = r.rows[0].mensagens || [];
      msgs.push(msg);
      const flagCol = de === 'prefeitura' ? 'cidadao_nao_lido' : 'admin_nao_lido';
      await pool.query(`UPDATE ocorrencias SET mensagens=$1, ${flagCol}=true WHERE id=$2`, [JSON.stringify(msgs), id]);
      return msg;
    }
    const oc = jsonDB.ocorrencias.find(o => o.id === id);
    if (!oc) return null;
    if (!oc.mensagens) oc.mensagens = [];
    oc.mensagens.push(msg);
    if (de === 'prefeitura') oc.naoLidoCidadao = true; else oc.naoLidoAdmin = true;
    saveJsonDB();
    return msg;
  },
  // `lado` é 'admin' ou 'cidadao': zera a flag de não-lido correspondente ao abrir o detalhe.
  async marcarLida(id, lado) {
    const col = lado === 'admin' ? 'admin_nao_lido' : 'cidadao_nao_lido';
    if (usePostgres) {
      await pool.query(`UPDATE ocorrencias SET ${col}=false WHERE id=$1`, [id]);
      return;
    }
    const oc = jsonDB.ocorrencias.find(o => o.id === id);
    if (!oc) return;
    if (lado === 'admin') oc.naoLidoAdmin = false; else oc.naoLidoCidadao = false;
    saveJsonDB();
  },
  async contarNaoLidasAdmin() {
    if (usePostgres) {
      const r = await pool.query('SELECT COUNT(*) FROM ocorrencias WHERE admin_nao_lido=true');
      return parseInt(r.rows[0].count);
    }
    return jsonDB.ocorrencias.filter(o => o.naoLidoAdmin).length;
  },
  // Pedido de reabertura feito pelo cidadão após a ocorrência ser marcada como resolvida.
  // Não muda o status sozinho — fica registrado para o operador decidir e agir via updateStatus.
  async pedirReabertura(id, motivo) {
    const agora = new Date().toISOString();
    const pedido = { motivo, data: agora, atendido: false };
    if (usePostgres) {
      const r = await pool.query('SELECT pedidos_reabertura FROM ocorrencias WHERE id=$1', [id]);
      if (!r.rows[0]) return null;
      const pedidos = r.rows[0].pedidos_reabertura || [];
      pedidos.push(pedido);
      await pool.query('UPDATE ocorrencias SET pedidos_reabertura=$1, admin_nao_lido=true WHERE id=$2', [JSON.stringify(pedidos), id]);
      return pedido;
    }
    const oc = jsonDB.ocorrencias.find(o => o.id === id);
    if (!oc) return null;
    if (!oc.pedidosReabertura) oc.pedidosReabertura = [];
    oc.pedidosReabertura.push(pedido);
    oc.naoLidoAdmin = true;
    saveJsonDB();
    return pedido;
  },
  async getStats() {
    if (usePostgres) {
      const total = await pool.query('SELECT COUNT(*) FROM ocorrencias');
      const byStatus = await pool.query(`SELECT status, COUNT(*) as n FROM ocorrencias GROUP BY status`);
      const byCat = await pool.query(`SELECT categoria, COUNT(*) as n FROM ocorrencias GROUP BY categoria ORDER BY n DESC`);
      const byBairro = await pool.query(`SELECT bairro, COUNT(*) as n FROM ocorrencias GROUP BY bairro ORDER BY n DESC LIMIT 5`);
      const sm = {}; byStatus.rows.forEach(r => sm[r.status] = parseInt(r.n));
      const naoLidas = await pool.query('SELECT COUNT(*) FROM ocorrencias WHERE admin_nao_lido=true');
      const atrasadas = await pool.query(`SELECT COUNT(*) FROM ocorrencias WHERE prazo IS NOT NULL AND prazo < NOW() AND status <> 'Resolvida'`);
      return {
        total: parseInt(total.rows[0].count),
        recebida: sm['Recebida']||0, analise: sm['Em análise']||0,
        encaminhada: sm['Encaminhada']||0, atendimento: sm['Em atendimento']||0, resolvida: sm['Resolvida']||0,
        categorias: byCat.rows.map(r => [r.categoria, parseInt(r.n)]),
        bairros: byBairro.rows.map(r => [r.bairro, parseInt(r.n)]),
        naoLidas: parseInt(naoLidas.rows[0].count),
        atrasadas: parseInt(atrasadas.rows[0].count)
      };
    }
    const ocs = jsonDB.ocorrencias;
    const catMap = {}, bairroMap = {};
    ocs.forEach(o => { catMap[o.categoria]=(catMap[o.categoria]||0)+1; bairroMap[o.bairro]=(bairroMap[o.bairro]||0)+1; });
    const agora = Date.now();
    return {
      total: ocs.length,
      recebida: ocs.filter(o=>o.status==='Recebida').length,
      analise: ocs.filter(o=>o.status==='Em análise').length,
      encaminhada: ocs.filter(o=>o.status==='Encaminhada').length,
      atendimento: ocs.filter(o=>o.status==='Em atendimento').length,
      resolvida: ocs.filter(o=>o.status==='Resolvida').length,
      categorias: Object.entries(catMap).sort((a,b)=>b[1]-a[1]),
      bairros: Object.entries(bairroMap).sort((a,b)=>b[1]-a[1]).slice(0,5),
      naoLidas: ocs.filter(o => o.naoLidoAdmin).length,
      atrasadas: ocs.filter(o => o.prazo && o.status !== 'Resolvida' && new Date(o.prazo).getTime() < agora).length
    };
  },
  async listChatMensagens(limit = 60) {
    if (usePostgres) {
      const r = await pool.query('SELECT * FROM chat_mensagens ORDER BY criado_em DESC LIMIT $1', [limit]);
      return r.rows.reverse().map(m => ({ id:m.id, userId:m.user_id, nome:m.nome, texto:m.texto, criadoEm:m.criado_em }));
    }
    return jsonDB.chatMensagens.slice(-limit);
  },
  async addChatMensagem(msg) {
    if (usePostgres) {
      await pool.query('INSERT INTO chat_mensagens (id,user_id,nome,texto) VALUES ($1,$2,$3,$4)', [msg.id, msg.userId, msg.nome, msg.texto]);
      return;
    }
    jsonDB.chatMensagens.push(msg);
    if (jsonDB.chatMensagens.length > 300) jsonDB.chatMensagens = jsonDB.chatMensagens.slice(-300);
    saveJsonDB();
  },
  async salvarArquivo(id, mime, dados) {
    if (usePostgres) {
      await pool.query('INSERT INTO arquivos (id,mime,dados) VALUES ($1,$2,$3)', [id, mime, dados]);
      return;
    }
    // Nunca poda arquivos automaticamente aqui: um arquivo antigo pode ainda estar referenciado
    // como foto de uma ocorrência ou de um perfil, e apagá-lo silenciosamente quebraria essa
    // referência sem qualquer aviso.
    jsonDB.arquivos.push({ id, mime, dados, criadoEm:new Date().toISOString() });
    saveJsonDB();
  },
  async buscarArquivo(id) {
    if (usePostgres) {
      const r = await pool.query('SELECT mime, dados FROM arquivos WHERE id=$1', [id]);
      return r.rows[0] || null;
    }
    const a = jsonDB.arquivos.find(a => a.id === id);
    return a ? { mime:a.mime, dados:a.dados } : null;
  }
};

function parseBody(req) {
  return new Promise((res, rej) => {
    let body = '';
    let tooLarge = false;
    req.on('data', c => {
      if (tooLarge) return;
      body += c;
      if (body.length > 20e6) {
        tooLarge = true;
        const err = new Error('PAYLOAD_TOO_LARGE');
        err.tooLarge = true;
        req.destroy(err);
      }
    });
    req.on('end', () => {
      if (tooLarge) return;
      try { res(JSON.parse(body || '{}')); } catch { res({}); }
    });
    req.on('error', (err) => {
      if (tooLarge || (err && err.tooLarge)) { rej(Object.assign(new Error('PAYLOAD_TOO_LARGE'), { tooLarge:true })); }
      else rej(err);
    });
  });
}

// Headers de segurança aplicados em toda resposta (API, estáticos e arquivos).
//
// script-src e style-src mantêm 'unsafe-inline': o app usa onclick="..." e style="..." em
// milhares de pontos do markup, gerados dinamicamente em runtime (template literals com IDs
// variáveis, ex. onclick="abrirMoradorDet('${o.id}')"). Um nonce por requisição só cobre a
// própria tag <script>, não atributos de evento inline — tentar removê-lo quebra literalmente
// todo botão da aplicação (testado: qualquer onclick para de executar, CSP bloqueia com
// "Refused to execute inline event handler"). 'unsafe-hashes' também não serve aqui, porque o
// conteúdo desses atributos muda a cada render (IDs diferentes por ocorrência/usuário), então
// não há um hash fixo para permitir. Migrar isso de verdade exigiria reescrever todo o
// event-handling do front-end para addEventListener — fora do escopo de um patch de segurança
// que não pode quebrar funcionalidades. O que a CSP abaixo ainda trava de verdade: qualquer
// <script src="https://dominio-malicioso.com/..."> injetado via XSS (script-src limita a origens
// já confiáveis), carregamento de imagens/mídia/fontes de origens arbitrárias, ser embutido em
// iframe de terceiros (frame-ancestors) e submissão de formulários para fora do site.
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(self), camera=(), microphone=(), payment=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': [
    "default-src 'self'",
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://unpkg.com",
    "media-src 'self'",
    "script-src 'self' https://unpkg.com 'unsafe-inline'",
    "style-src 'self' https://unpkg.com https://fonts.googleapis.com 'unsafe-inline'",
    "font-src 'self' https://fonts.gstatic.com data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ')
};
// Restrito à própria origem do app em produção (VERCEL_URL/PUBLIC_ORIGIN); '*' só permanece
// como fallback de desenvolvimento local, onde a origem pode mudar de porta a cada teste.
const ALLOWED_ORIGIN = process.env.PUBLIC_ORIGIN || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
const CORS_HEADERS = { 'Access-Control-Allow-Origin': ALLOWED_ORIGIN || '*', 'Access-Control-Allow-Headers':'Content-Type,Authorization', 'Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS', 'Vary': 'Origin' };
function sendIndexHtml(res, idxPath) {
  let html;
  try { html = fs.readFileSync(idxPath, 'utf8'); } catch { return json(res, 404, { erro:'Não encontrado' }); }
  const body = Buffer.from(html, 'utf8');
  res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8', 'Content-Length': body.length, ...SECURITY_HEADERS });
  res.end(body);
}

function json(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, { 'Content-Type':'application/json', ...CORS_HEADERS, ...SECURITY_HEADERS });
  res.end(body);
}

function getToken(req) { return (req.headers['authorization']||'').replace('Bearer ','').trim(); }

async function authUser(req) {
  const token = getToken(req);
  if (!token) return null;
  const session = await db.getSession(token);
  if (!session) return null;
  return await db.findUserById(session.userId);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { ...CORS_HEADERS, ...SECURITY_HEADERS });
    return res.end();
  }

  if (req.method === 'GET' && !pathname.startsWith('/api/')) {
    const publicDir = path.join(__dirname, 'public');
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(publicDir, filePath);
    // Defesa extra contra path traversal, mesmo o URL nativo já normalizando "..".
    const dentroDoPublic = filePath === publicDir || filePath.startsWith(publicDir + path.sep);
    const idx = path.join(publicDir, 'index.html');
    if (dentroDoPublic && filePath === idx && fs.existsSync(idx)) {
      return sendIndexHtml(res, idx);
    }
    if (dentroDoPublic && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const mime = { '.html':'text/html', '.css':'text/css', '.js':'application/javascript', '.png':'image/png', '.jpg':'image/jpeg', '.gif':'image/gif', '.svg':'image/svg+xml', '.webp':'image/webp', '.mp4':'video/mp4', '.webm':'video/webm' };
      const contentType = mime[ext] || 'application/octet-stream';
      const { size } = fs.statSync(filePath);

      const range = req.headers.range;
      if (range) {
        const match = /bytes=(\d*)-(\d*)/.exec(range);
        const start = match && match[1] ? parseInt(match[1], 10) : 0;
        const end = match && match[2] ? parseInt(match[2], 10) : size - 1;
        if (isNaN(start) || isNaN(end) || start > end || end >= size) {
          res.writeHead(416, { 'Content-Range': `bytes */${size}`, ...SECURITY_HEADERS });
          return res.end();
        }
        res.writeHead(206, {
          'Content-Type': contentType,
          'Content-Length': end - start + 1,
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Accept-Ranges': 'bytes',
          ...SECURITY_HEADERS
        });
        return fs.createReadStream(filePath, { start, end }).pipe(res);
      }

      res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': size, 'Accept-Ranges': 'bytes', ...SECURITY_HEADERS });
      return fs.createReadStream(filePath).pipe(res);
    }
    if (fs.existsSync(idx)) return sendIndexHtml(res, idx);
    return json(res, 404, { erro: 'Não encontrado' });
  }

  try {
    if (!dbReady) {
      return json(res, 503, { erro: 'Serviço temporariamente indisponível (banco de dados fora do ar). Tente novamente em instantes.' });
    }

    if (pathname === '/api/cadastro' && req.method === 'POST') {
      const rl = rateLimit('cadastro:' + clientIp(req), 8, 60 * 60 * 1000);
      if (rl.limited) return json(res, 429, { erro: `Muitas tentativas. Tente novamente em ${Math.ceil(rl.retryAfter/60)} min.` });
      const { nome, email, senha, bairro } = await parseBody(req);
      if (typeof nome !== 'string' || !nome.trim() || typeof email !== 'string' || !email.trim() || typeof senha !== 'string' || !senha) return json(res, 400, { erro:'Preencha todos os campos.' });
      if (email.length > 254 || nome.length > 300) return json(res, 400, { erro:'Campo excede o tamanho máximo.' });
      const emailNorm = email.trim().toLowerCase();
      if (!EMAIL_RE.test(emailNorm)) return json(res, 400, { erro:'E-mail inválido.' });
      if (senha.length < 6) return json(res, 400, { erro:'Senha deve ter no mínimo 6 caracteres.' });
      if (senha.length > 200) return json(res, 400, { erro:'Senha muito longa.' });
      // Mesma lista fechada de bairros usada ao registrar uma ocorrência — sem isso, o campo
      // (um <select> no formulário, mas qualquer texto via chamada direta à API) aceitava
      // qualquer string arbitrária no cadastro.
      if (bairro !== undefined && bairro !== '' && !BAIRROS_VALIDOS.has(bairro)) return json(res, 400, { erro:'Bairro inválido.' });
      if (await db.emailExists(emailNorm)) return json(res, 400, { erro:'E-mail já cadastrado.' });
      await db.createUser({ id:'u'+Date.now()+Math.random().toString(36).slice(2,7), nome:cap(nome,100), email:emailNorm, senha:hashPassword(senha), role:'morador', bairro:cap(bairro,60)||'', foto:null });
      return json(res, 201, { ok:true });
    }

    if (pathname === '/api/login' && req.method === 'POST') {
      const rl = rateLimit('login:' + clientIp(req), 10, 15 * 60 * 1000);
      if (rl.limited) return json(res, 429, { erro: `Muitas tentativas de login. Tente novamente em ${Math.ceil(rl.retryAfter/60)} min.` });
      const { email, senha } = await parseBody(req);
      if (typeof email !== 'string' || !email.trim() || typeof senha !== 'string' || !senha) return json(res, 400, { erro:'Preencha e-mail e senha.' });
      // Limite de tamanho ANTES de gastar CPU com scrypt: sem isso, um payload de senha
      // gigante (o body aceita até 20MB) força o servidor a derivar hash de uma entrada enorme
      // a cada tentativa — um vetor barato de negação de serviço, mesmo com rate limit por IP.
      if (email.length > 254 || senha.length > 200) return json(res, 400, { erro:'E-mail ou senha incorretos.' });
      const user = await db.findUser(email.trim().toLowerCase());
      if (!user || !verifyPassword(senha, user.senha)) return json(res, 401, { erro:'E-mail ou senha incorretos.' });
      if (isLegacyHash(user.senha)) await db.updateSenha(user.id, hashPassword(senha)); // reforça o hash de contas antigas de forma transparente
      const token = genToken();
      await db.createSession(token, user.id, Date.now() + SESSION_TTL_MS);
      return json(res, 200, { token, role:user.role, nome:user.nome, email:user.email, id:user.id, termosAceitos: !!user.termosAceitosEm, foto:user.foto||null });
    }

    if (pathname === '/api/logout' && req.method === 'POST') {
      const token = getToken(req);
      if (token) await db.deleteSession(token);
      return json(res, 200, { ok:true });
    }

    if (pathname === '/api/me' && req.method === 'GET') {
      const user = await authUser(req);
      if (!user) return json(res, 401, { erro:'Não autenticado.' });
      const { senha, ...safe } = user;
      safe.termosAceitos = !!user.termosAceitosEm;
      return json(res, 200, safe);
    }

    if (pathname === '/api/aceitar-termos' && req.method === 'POST') {
      const user = await authUser(req);
      if (!user) return json(res, 401, { erro:'Não autenticado.' });
      await db.aceitarTermos(user.id);
      return json(res, 200, { ok:true });
    }

    if (pathname === '/api/perfil' && req.method === 'GET') {
      const user = await authUser(req);
      if (!user) return json(res, 401, { erro:'Não autenticado.' });
      const minhas = await db.listOcorrencias({ userId: user.id });
      const resolvidas = minhas.filter(o => o.status === 'Resolvida').length;
      const apoiosDados = await db.contarApoiosDados(user.id);
      return json(res, 200, {
        nome:user.nome, email:user.email, foto:user.foto||null,
        stats: { ocorrencias: minhas.length, resolvidas, apoiosDados }
      });
    }

    if (pathname === '/api/perfil' && req.method === 'PUT') {
      const user = await authUser(req);
      if (!user) return json(res, 401, { erro:'Não autenticado.' });
      const { nome, foto } = await parseBody(req);
      const upd = {};
      if (nome !== undefined) {
        if (typeof nome !== 'string' || !nome.trim()) return json(res, 400, { erro:'Nome não pode ficar em branco.' });
        upd.nome = cap(nome, 100);
      }
      if (foto !== undefined) {
        if (!isOwnUploadUrl(foto)) return json(res, 400, { erro:'Foto inválida.' });
        upd.foto = foto;
      }
      await db.updatePerfil(user.id, upd);
      return json(res, 200, { ok:true });
    }

    const matchPerfilPublico = pathname.match(/^\/api\/usuarios\/([^/]+)\/perfil$/);
    if (matchPerfilPublico && req.method === 'GET') {
      const user = await authUser(req);
      if (!user) return json(res, 401, { erro:'Não autenticado.' });
      const alvo = await db.findUserById(matchPerfilPublico[1]);
      if (!alvo) return json(res, 404, { erro:'Usuário não encontrado.' });
      const dele = await db.listOcorrencias({ userId: alvo.id });
      const resolvidas = dele.filter(o => o.status === 'Resolvida').length;
      const apoiosDados = await db.contarApoiosDados(alvo.id);
      return json(res, 200, {
        nome:alvo.nome, foto:alvo.foto||null,
        stats: { ocorrencias: dele.length, resolvidas, apoiosDados }
      });
    }

    if (pathname === '/api/chat' && req.method === 'GET') {
      const user = await authUser(req);
      if (!user) return json(res, 401, { erro:'Não autenticado.' });
      const msgs = await db.listChatMensagens();
      const usuariosPorId = {};
      for (const uid of [...new Set(msgs.map(m => m.userId))]) {
        usuariosPorId[uid] = await db.findUserById(uid);
      }
      // Nome e foto sempre refletem o perfil atual do autor, não um retrato da mensagem antiga.
      return json(res, 200, msgs.map(m => {
        const u = usuariosPorId[m.userId];
        return { ...m, nome: u ? u.nome : m.nome, foto: u ? (u.foto || null) : null };
      }));
    }

    if (pathname === '/api/chat' && req.method === 'POST') {
      const user = await authUser(req);
      if (!user) return json(res, 401, { erro:'Não autenticado.' });
      const rl = rateLimit('chat:' + user.id, 30, 60 * 1000);
      if (rl.limited) return json(res, 429, { erro: 'Você está enviando mensagens rápido demais. Espere um pouco.' });
      const { texto } = await parseBody(req);
      if (typeof texto !== 'string' || !texto.trim()) return json(res, 400, { erro:'Mensagem vazia.' });
      const msg = { id:'msg'+Date.now()+Math.random().toString(36).slice(2,7), userId:user.id, nome:user.nome, texto:cap(texto,500), criadoEm:new Date().toISOString() };
      await db.addChatMensagem(msg);
      return json(res, 201, { ok:true, id: msg.id });
    }

    if (pathname === '/api/stats' && req.method === 'GET') {
      const user = await authUser(req);
      const stats = await db.getStats();
      if (!user || user.role !== 'admin') {
        return json(res, 200, { total:stats.total, resolvida:stats.resolvida, atendimento:stats.atendimento, analise:stats.analise });
      }
      return json(res, 200, stats);
    }

    if (pathname === '/api/ocorrencias' && req.method === 'GET') {
      const user = await authUser(req);
      if (!user) return json(res, 401, { erro:'Não autenticado.' });
      const filters = user.role === 'morador'
        ? { userId: user.id }
        : { status: url.searchParams.get('status'), categoria: url.searchParams.get('categoria'), bairro: url.searchParams.get('bairro'), busca: url.searchParams.get('busca') };
      return json(res, 200, await db.listOcorrencias(filters));
    }

    if (pathname === '/api/ocorrencias' && req.method === 'POST') {
      const user = await authUser(req);
      if (!user) return json(res, 401, { erro:'Não autenticado.' });
      if (!user.termosAceitosEm) return json(res, 403, { erro:'É preciso aceitar os termos de uso antes de registrar uma ocorrência.' });
      const rl = rateLimit('ocorrencia:' + user.id, 20, 60 * 60 * 1000);
      if (rl.limited) return json(res, 429, { erro: 'Muitas denúncias em pouco tempo. Tente novamente mais tarde.' });
      const { titulo, descricao, categoria, endereco, bairro, referencia, foto, lat, lng, precisao } = await parseBody(req);
      if (typeof titulo !== 'string' || !titulo.trim() || !categoria || typeof endereco !== 'string' || !endereco.trim() || !bairro) return json(res, 400, { erro:'Preencha os campos obrigatórios.' });
      if (!CATEGORIAS_VALIDAS.has(categoria)) return json(res, 400, { erro:'Categoria inválida.' });
      if (!BAIRROS_VALIDOS.has(bairro)) return json(res, 400, { erro:'Bairro inválido.' });
      if (!isOwnUploadUrl(foto)) return json(res, 400, { erro:'Foto inválida.' });
      const temLat = lat !== undefined && lat !== null;
      const temLng = lng !== undefined && lng !== null;
      if (temLat !== temLng) return json(res, 400, { erro:'Localização incompleta.' });
      if (temLat && !isCoordenadaValida(lat, lng)) return json(res, 400, { erro:'Localização inválida.' });
      const precisaoLocal = temLat ? (precisao === 'gps' ? 'gps' : 'manual') : 'aproximado';
      const protocolo = await gerarProtocolo();
      const agora = new Date().toISOString();
      const oc = { id:'oc'+Date.now()+Math.random().toString(36).slice(2,7), protocolo, userId:user.id, titulo:cap(titulo,150), descricao:cap(descricao,3000)||'', categoria, endereco:cap(endereco,200), bairro, referencia:cap(referencia,200)||'', foto:foto||null, status:'Recebida', criadoEm:agora, atualizadoEm:agora, historico:[{status:'Recebida',data:agora,obs:'Ocorrência registrada pelo cidadão'}], mensagens:[], lat: temLat ? lat : null, lng: temLat ? lng : null, apoios:[], avaliacao:null, precisaoLocal, responsavel:null, setor:null, prazo:null, evidenciaResolucao:null, pedidosReabertura:[], naoLidoAdmin:false, naoLidoCidadao:false };
      await db.createOcorrencia(oc);
      return json(res, 201, { ok:true, protocolo, id:oc.id });
    }

    const matchDet = pathname.match(/^\/api\/ocorrencias\/([^/]+)$/);
    if (matchDet && req.method === 'GET') {
      const user = await authUser(req);
      if (!user) return json(res, 401, { erro:'Não autenticado.' });
      const oc = await db.getOcorrencia(matchDet[1]);
      if (!oc) return json(res, 404, { erro:'Não encontrada.' });
      if (user.role === 'morador' && oc.userId !== user.id) return json(res, 403, { erro:'Sem permissão.' });
      return json(res, 200, oc);
    }

    const matchUpd = pathname.match(/^\/api\/ocorrencias\/([^/]+)\/status$/);
    if (matchUpd && req.method === 'PUT') {
      const user = await authUser(req);
      if (!user || user.role !== 'admin') return json(res, 403, { erro:'Acesso negado.' });
      const { status, obs, setor, responsavel, prazo, evidencia } = await parseBody(req);
      if (!STATUS_VALIDOS.has(status)) return json(res, 400, { erro:'Status inválido.' });
      const atual = await db.getOcorrencia(matchUpd[1]);
      if (!atual) return json(res, 404, { erro:'Não encontrada.' });
      const idxAtual = STATUS_ORDEM.indexOf(atual.status);
      const idxNovo = STATUS_ORDEM.indexOf(status);
      const isRegressao = idxAtual !== -1 && idxNovo !== -1 && idxNovo < idxAtual;
      const obsLimpa = cap(obs, 500);
      if (isRegressao && (!obsLimpa || !obsLimpa.trim())) {
        return json(res, 400, { erro:'Para retroceder o status é preciso informar uma justificativa.' });
      }
      if (status === 'Resolvida' && atual.pedidosReabertura && atual.pedidosReabertura.length) {
        const pendente = atual.pedidosReabertura[atual.pedidosReabertura.length - 1];
        if (pendente && !pendente.atendido && !obsLimpa) {
          return json(res, 400, { erro:'Há um pedido de reabertura pendente — informe uma justificativa ao resolver novamente.' });
        }
      }
      const opts = {
        obs: obsLimpa,
        setor: setor !== undefined ? cap(setor, 100) : undefined,
        responsavel: responsavel !== undefined ? cap(responsavel, 100) : undefined,
        prazo: prazo !== undefined ? (prazo || null) : undefined,
        evidencia: evidencia !== undefined ? cap(evidencia, 500) : undefined,
        tipoEvento: isRegressao ? 'reabertura' : undefined
      };
      const ok = await db.updateStatus(matchUpd[1], status, opts);
      if (!ok) return json(res, 404, { erro:'Não encontrada.' });
      await db.marcarLida(matchUpd[1], 'admin');
      return json(res, 200, { ok:true });
    }

    const matchMsg = pathname.match(/^\/api\/ocorrencias\/([^/]+)\/mensagens$/);
    if (matchMsg && req.method === 'POST') {
      const user = await authUser(req);
      if (!user) return json(res, 401, { erro:'Não autenticado.' });
      const oc = await db.getOcorrencia(matchMsg[1]);
      if (!oc) return json(res, 404, { erro:'Não encontrada.' });
      if (user.role !== 'admin' && oc.userId !== user.id) return json(res, 403, { erro:'Sem permissão.' });
      const rl = rateLimit('mensagem:' + user.id, 60, 60 * 60 * 1000);
      if (rl.limited) return json(res, 429, { erro: 'Muitas mensagens em pouco tempo. Tente novamente mais tarde.' });
      const { texto } = await parseBody(req);
      const textoLimpo = cap(texto, 1000);
      if (!textoLimpo || !textoLimpo.trim()) return json(res, 400, { erro:'Mensagem vazia.' });
      const de = user.role === 'admin' ? 'prefeitura' : 'cidadao';
      const msg = await db.addMensagem(matchMsg[1], de, textoLimpo);
      if (!msg) return json(res, 404, { erro:'Não encontrada.' });
      return json(res, 201, { ok:true, mensagem: msg });
    }

    const matchLida = pathname.match(/^\/api\/ocorrencias\/([^/]+)\/marcar-lida$/);
    if (matchLida && req.method === 'POST') {
      const user = await authUser(req);
      if (!user) return json(res, 401, { erro:'Não autenticado.' });
      const oc = await db.getOcorrencia(matchLida[1]);
      if (!oc) return json(res, 404, { erro:'Não encontrada.' });
      if (user.role !== 'admin' && oc.userId !== user.id) return json(res, 403, { erro:'Sem permissão.' });
      await db.marcarLida(matchLida[1], user.role === 'admin' ? 'admin' : 'cidadao');
      return json(res, 200, { ok:true });
    }

    const matchReabrir = pathname.match(/^\/api\/ocorrencias\/([^/]+)\/reabrir$/);
    if (matchReabrir && req.method === 'POST') {
      const user = await authUser(req);
      if (!user) return json(res, 401, { erro:'Não autenticado.' });
      const oc = await db.getOcorrencia(matchReabrir[1]);
      if (!oc) return json(res, 404, { erro:'Não encontrada.' });
      if (oc.userId !== user.id) return json(res, 403, { erro:'Sem permissão.' });
      if (oc.status !== 'Resolvida') return json(res, 400, { erro:'Só é possível pedir reabertura de ocorrências resolvidas.' });
      const { motivo } = await parseBody(req);
      const motivoLimpo = cap(motivo, 500);
      if (!motivoLimpo || !motivoLimpo.trim()) return json(res, 400, { erro:'Descreva o motivo do pedido de reabertura.' });
      const pedido = await db.pedirReabertura(matchReabrir[1], motivoLimpo);
      if (!pedido) return json(res, 404, { erro:'Não encontrada.' });
      return json(res, 201, { ok:true, pedido });
    }

    const matchApoio = pathname.match(/^\/api\/ocorrencias\/([^/]+)\/apoiar$/);
    if (matchApoio && req.method === 'POST') {
      const user = await authUser(req);
      if (!user) return json(res, 401, { erro:'Não autenticado.' });
      const oc = await db.getOcorrencia(matchApoio[1]);
      if (!oc) return json(res, 404, { erro:'Não encontrada.' });
      if (oc.userId === user.id) return json(res, 400, { erro:'Você não pode apoiar sua própria ocorrência.' });
      const r = await db.toggleApoio(matchApoio[1], user.id);
      return json(res, 200, r);
    }

    const matchAval = pathname.match(/^\/api\/ocorrencias\/([^/]+)\/avaliar$/);
    if (matchAval && req.method === 'POST') {
      const user = await authUser(req);
      if (!user) return json(res, 401, { erro:'Não autenticado.' });
      const oc = await db.getOcorrencia(matchAval[1]);
      if (!oc) return json(res, 404, { erro:'Não encontrada.' });
      if (oc.userId !== user.id) return json(res, 403, { erro:'Sem permissão.' });
      if (oc.status !== 'Resolvida') return json(res, 400, { erro:'Só é possível avaliar ocorrências resolvidas.' });
      if (oc.avaliacao) return json(res, 400, { erro:'Ocorrência já avaliada.' });
      const { nota, comentario } = await parseBody(req);
      const n = parseInt(nota);
      if (!n || n < 1 || n > 5) return json(res, 400, { erro:'Nota inválida.' });
      const avaliacao = await db.avaliar(matchAval[1], n, cap(comentario,500));
      return json(res, 200, { ok:true, avaliacao });
    }

    if (pathname === '/api/mapa' && req.method === 'GET') {
      const user = await authUser(req);
      if (!user) return json(res, 401, { erro:'Não autenticado.' });
      const todas = await db.listOcorrencias({});
      const pontos = todas.map(o => ({
        id:o.id, protocolo:o.protocolo, titulo:o.titulo, categoria:o.categoria, status:o.status,
        bairro:o.bairro, lat:o.lat, lng:o.lng, apoios:(o.apoios||[]).length,
        apoiado: (o.apoios||[]).includes(user.id), isMine: o.userId === user.id,
        nomeUsuario: user.role === 'admin' ? o.nomeUsuario : null,
        precisaoLocal: o.precisaoLocal || 'manual'
      }));
      return json(res, 200, pontos);
    }

    if (pathname === '/api/geocode' && req.method === 'GET') {
      const user = await authUser(req);
      if (!user) return json(res, 401, { erro:'Não autenticado.' });
      const rl = rateLimit('geocode:' + user.id, 30, 60 * 1000);
      if (rl.limited) return json(res, 429, { erro:'Muitas buscas de endereço em pouco tempo. Aguarde um instante.' });
      const latParam = url.searchParams.get('lat');
      const lngParam = url.searchParams.get('lng');
      if (latParam !== null && lngParam !== null) {
        const lat = parseFloat(latParam), lng = parseFloat(lngParam);
        if (!isCoordenadaValida(lat, lng)) return json(res, 400, { erro:'Coordenadas inválidas.' });
        try {
          const r = await reverseGeocodeNominatim(lat, lng);
          const addr = (r && r.address) || {};
          return json(res, 200, {
            enderecoSugerido: r?.display_name || null,
            rua: addr.road || addr.pedestrian || addr.residential || null,
            numero: addr.house_number || null,
            bairroDetectado: addr.suburb || addr.neighbourhood || addr.village || null
          });
        } catch (e) {
          console.error('Erro na geocodificação reversa:', e.message);
          return json(res, 502, { erro:'Não foi possível identificar o endereço agora. Tente novamente.' });
        }
      }
      const q = (url.searchParams.get('q') || '').trim();
      if (!q || q.length < 3) return json(res, 400, { erro:'Digite ao menos 3 caracteres para buscar o endereço.' });
      try {
        const resultados = await geocodeNominatim(q + ', Braço do Norte, SC, Brasil');
        const pontos = (Array.isArray(resultados) ? resultados : []).slice(0,5).map(r => ({
          lat: parseFloat(r.lat), lng: parseFloat(r.lon), nome: r.display_name
        })).filter(p => isCoordenadaValida(p.lat, p.lng));
        return json(res, 200, pontos);
      } catch (e) {
        console.error('Erro na geocodificação:', e.message);
        return json(res, 502, { erro:'Não foi possível consultar o serviço de endereços agora. Tente novamente.' });
      }
    }

    if (pathname === '/api/recuperar-senha' && req.method === 'POST') {
      const rl = rateLimit('recuperar:' + clientIp(req), 6, 60 * 60 * 1000);
      if (rl.limited) return json(res, 429, { erro:'Muitas solicitações. Tente novamente mais tarde.' });
      const { email } = await parseBody(req);
      const emailNorm = typeof email === 'string' ? email.trim().toLowerCase() : '';
      const resposta = { ok:true, mensagem:'Se o e-mail existir em nossa base, enviaremos as instruções de redefinição.' };
      if (!emailNorm) return json(res, 200, resposta);
      const user = await db.findUser(emailNorm);
      if (!user) return json(res, 200, resposta);
      const tokenBruto = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(tokenBruto).digest('hex');
      const expiraEm = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await db.setResetToken(emailNorm, tokenHash, expiraEm);
      const linkRedefinicao = `${baseUrlFromReq(req)}/?reset=${tokenBruto}`;
      // Ordem de prioridade: Gmail (não exige domínio próprio) > Resend (exige domínio
      // verificado para entregar a qualquer destinatário) > modo de demonstração.
      const temGmail = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
      const temResend = !!process.env.RESEND_API_KEY;
      // Log incondicional a cada tentativa — assim dá pra ver nos logs da Vercel exatamente
      // qual caminho foi tomado (Gmail, Resend ou nenhum configurado), mesmo quando dá certo.
      console.log(`[recuperar-senha] GMAIL_USER=${process.env.GMAIL_USER ? 'definido' : 'ausente'} GMAIL_APP_PASSWORD=${process.env.GMAIL_APP_PASSWORD ? 'definido' : 'ausente'} RESEND_API_KEY=${process.env.RESEND_API_KEY ? 'definido' : 'ausente'} usePostgres=${usePostgres}`);
      if (temGmail || temResend) {
        try {
          if (temGmail) await enviarEmailRecuperacaoGmail(emailNorm, linkRedefinicao);
          else await enviarEmailRecuperacaoResend(emailNorm, linkRedefinicao);
          console.log(`[recuperar-senha] E-mail enviado com sucesso via ${temGmail ? 'Gmail' : 'Resend'} para ${emailNorm}`);
        } catch (e) {
          console.error(`Falha ao enviar e-mail de recuperação via ${temGmail ? 'Gmail' : 'Resend'}:`, e.message);
          console.log(`Token de redefinição de senha gerado para ${emailNorm} (falha no envio do e-mail): ${tokenBruto}`);
          if (!usePostgres || process.env.DEBUG_EXPOSE_RESET_TOKEN) {
            resposta.tokenDemo = tokenBruto;
            resposta.mensagem += ' (não foi possível enviar o e-mail agora; token incluído para fins de demonstração.)';
          }
        }
      } else if (!usePostgres || process.env.DEBUG_EXPOSE_RESET_TOKEN) {
        // Sem serviço de e-mail configurado. Para não vazar o token de redefinição em produção,
        // ele só é devolvido na resposta em modo de desenvolvimento (JSON local) ou se
        // DEBUG_EXPOSE_RESET_TOKEN estiver explicitamente definido (uso educacional/demonstração).
        console.log(`[recuperar-senha] Nenhum serviço de e-mail configurado — caiu no modo demonstração (usePostgres=${usePostgres}, DEBUG_EXPOSE_RESET_TOKEN=${!!process.env.DEBUG_EXPOSE_RESET_TOKEN}).`);
        resposta.tokenDemo = tokenBruto;
        resposta.mensagem += ' (modo demonstração: token incluído na resposta pois não há serviço de e-mail configurado.)';
      } else {
        console.log(`Token de redefinição de senha gerado para ${emailNorm} (envio de e-mail não configurado): ${tokenBruto}`);
      }
      return json(res, 200, resposta);
    }

    if (pathname === '/api/redefinir-senha' && req.method === 'POST') {
      const rl = rateLimit('redefinir:' + clientIp(req), 10, 60 * 60 * 1000);
      if (rl.limited) return json(res, 429, { erro:'Muitas tentativas. Tente novamente mais tarde.' });
      const { token, senha } = await parseBody(req);
      if (typeof token !== 'string' || !token.trim()) return json(res, 400, { erro:'Token inválido.' });
      if (typeof senha !== 'string' || senha.length < 6) return json(res, 400, { erro:'A nova senha precisa ter ao menos 6 caracteres.' });
      const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
      const user = await db.findUserByResetTokenHash(tokenHash);
      if (!user) return json(res, 400, { erro:'Token inválido ou expirado. Solicite uma nova recuperação de senha.' });
      await db.updateSenha(user.id, hashPassword(senha));
      await db.clearResetToken(user.id);
      await db.deleteAllSessionsForUser(user.id);
      return json(res, 200, { ok:true, mensagem:'Senha redefinida com sucesso. Faça login com a nova senha.' });
    }

    if (pathname === '/api/upload' && req.method === 'POST') {
      const user = await authUser(req);
      if (!user) return json(res, 401, { erro:'Não autenticado.' });
      const rl = rateLimit('upload:' + user.id, 40, 60 * 60 * 1000);
      if (rl.limited) return json(res, 429, { erro: 'Muitos envios de imagem em pouco tempo. Tente novamente mais tarde.' });
      const { data } = await parseBody(req);
      if (!data || typeof data !== 'string') return json(res, 400, { erro:'Sem dados.' });
      const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(data);
      if (!match) return json(res, 400, { erro:'Formato de imagem inválido.' });
      const mime = match[1].toLowerCase();
      if (!ALLOWED_IMAGE_MIME.has(mime)) return json(res, 400, { erro:'Tipo de imagem não suportado. Envie JPEG, PNG, WEBP ou GIF.' });
      const base64 = match[2];
      let buffer;
      try { buffer = Buffer.from(base64, 'base64'); } catch { return json(res, 400, { erro:'Imagem corrompida.' }); }
      if (!buffer.length) return json(res, 400, { erro:'Imagem vazia.' });
      if (buffer.length > MAX_IMAGE_BYTES) return json(res, 400, { erro:'Imagem muito grande (máx. 8MB).' });
      if (!assinaturaImagemValida(mime, buffer)) return json(res, 400, { erro:'O arquivo não é uma imagem válida do tipo declarado.' });
      // ID com 128 bits de entropia criptográfica — a única coisa que impede alguém de listar
      // fotos de outras pessoas é não conseguir adivinhar essa URL (a rota de leitura abaixo é
      // pública, sem checagem de dono, de propósito, pra funcionar em ocorrências/perfis
      // públicos). O formato antigo (Date.now() + Math.random()) era previsível e pequeno
      // demais pra servir como segredo.
      const id = 'img' + crypto.randomBytes(16).toString('hex');
      await db.salvarArquivo(id, mime, base64);
      return json(res, 200, { url:`/api/arquivos/${id}` });
    }

    const matchArquivo = pathname.match(/^\/api\/arquivos\/([A-Za-z0-9]+)$/);
    if (matchArquivo && req.method === 'GET') {
      const arq = await db.buscarArquivo(matchArquivo[1]);
      if (!arq) return json(res, 404, { erro:'Arquivo não encontrado.' });
      const buffer = Buffer.from(arq.dados, 'base64');
      res.writeHead(200, { 'Content-Type': arq.mime, 'Cache-Control': 'public, max-age=31536000, immutable', ...CORS_HEADERS, ...SECURITY_HEADERS });
      return res.end(buffer);
    }

    json(res, 404, { erro:'Rota não encontrada.' });
  } catch (e) {
    if (e && e.tooLarge) {
      console.error('Erro: payload muito grande');
      return json(res, 413, { erro:'Arquivo muito grande. Tente uma imagem menor.' });
    }
    console.error('Erro:', e.message);
    json(res, 500, { erro:'Erro interno do servidor.' });
  }
});

// O guard `require.main === module` deixa este arquivo exigível (`require('./server')`) sem
// efeito colateral de subir servidor/DB — é isso que permite os testes automatizados (Fase 3)
// importarem as funções puras abaixo (hashPassword, validações, etc.) e também instanciar o
// servidor sob demanda em testes de integração, sem duplicar a lógica de boot em outro arquivo.
// Rodando via `node server.js` (ou `npm start`) o comportamento é idêntico a antes.
if (require.main === module) {
  initDB().then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log('');
      console.log('Servidor Urbana rodando na porta ' + PORT);
      console.log(`http://localhost:${PORT}`);
      console.log('');
      console.log('Login admin: admin@prefeitura.gov.br / admin');
      console.log('');
    });
  });
}

module.exports = {
  server, initDB, PORT,
  hashPassword, verifyPassword, isLegacyHash,
  cap, isCoordenadaValida, isOwnUploadUrl, assinaturaImagemValida,
  rateLimit, genToken,
  EMAIL_RE, BAIRROS_VALIDOS, CATEGORIAS_VALIDAS, STATUS_VALIDOS, STATUS_ORDEM, ALLOWED_IMAGE_MIME,
};
