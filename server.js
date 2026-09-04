const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;

let usePostgres = false;
let pool = null;

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
          foto TEXT,
          premium BOOLEAN DEFAULT false
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
          avaliacao JSONB
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          criado_em TIMESTAMPTZ DEFAULT NOW()
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
        ALTER TABLE users ADD COLUMN IF NOT EXISTS termos_aceitos_em TIMESTAMPTZ;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS foto TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS premium BOOLEAN DEFAULT false;
        ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
        ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
        ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS apoios JSONB DEFAULT '[]';
        ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS avaliacao JSONB;
      `);
      const adminHash = hash('admin');
      await pool.query(`
        INSERT INTO users (id, nome, email, senha, role, termos_aceitos_em)
        VALUES ('u1','Admin Prefeitura','admin@prefeitura.gov.br',$1,'admin',NOW())
        ON CONFLICT (email) DO NOTHING
      `, [adminHash]);
      await pool.query(`INSERT INTO config (key,value) VALUES ('next_protocolo','4') ON CONFLICT (key) DO NOTHING`);
      await seedExamples();
      usePostgres = true;
      console.log('Banco PostgreSQL conectado');
    } catch (e) {
      console.log('PostgreSQL falhou, usando JSON local:', e.message);
      usePostgres = false;
      initJsonDB();
    }
  } else {
    console.log('Usando banco JSON local (db.json)');
    initJsonDB();
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
      return;
    } catch {}
  }
  jsonDB = {
    users: [{ id:'u1', nome:'Admin Prefeitura', email:'admin@prefeitura.gov.br', senha:hash('admin'), role:'admin', bairro:'', criadoEm:'2026-01-01T00:00:00.000Z', termosAceitosEm:'2026-01-01T00:00:00.000Z', foto:null, premium:false }],
    ocorrencias: [
      { id:'oc1', protocolo:'PROT-2026-0001', userId:'u1', titulo:'Buraco na Rua João Machado', descricao:'Buraco de aproximadamente 80cm de diâmetro na pista principal.', categoria:'Pavimentação', endereco:'Rua João Machado, 450', bairro:'Centro', referencia:'Em frente à padaria Pão de Mel', foto:null, status:'Em atendimento', criadoEm:'2026-01-02T14:32:00.000Z', atualizadoEm:'2026-01-05T08:00:00.000Z', historico:[{status:'Recebida',data:'2026-01-02T14:32:00.000Z',obs:'Registrada pelo cidadão'},{status:'Em análise',data:'2026-01-03T09:15:00.000Z',obs:'Avaliação técnica iniciada'},{status:'Encaminhada',data:'2026-01-03T16:48:00.000Z',obs:'Encaminhada para Secretaria de Obras'},{status:'Em atendimento',data:'2026-01-05T08:00:00.000Z',obs:'Equipe de campo em ação'}], mensagens:[], lat:-28.2761, lng:-49.1712, apoios:[], avaliacao:null },
      { id:'oc2', protocolo:'PROT-2026-0002', userId:'u1', titulo:'Poste sem iluminação — Av. Principal', descricao:'Poste apagado há mais de uma semana.', categoria:'Iluminação pública', endereco:'Av. Principal, 1200', bairro:'Centro', referencia:'Próximo ao Banco do Brasil', foto:null, status:'Em análise', criadoEm:'2026-01-05T10:00:00.000Z', atualizadoEm:'2026-01-06T09:00:00.000Z', historico:[{status:'Recebida',data:'2026-01-05T10:00:00.000Z',obs:'Registrada'},{status:'Em análise',data:'2026-01-06T09:00:00.000Z',obs:'Verificação agendada'}], mensagens:[], lat:-28.2745, lng:-49.1698, apoios:[], avaliacao:null },
      { id:'oc3', protocolo:'PROT-2026-0003', userId:'u1', titulo:'Descarte irregular — Santa Clara', descricao:'Lixo e entulho descartados irregularmente.', categoria:'Limpeza urbana', endereco:'Estrada Santa Clara, s/n', bairro:'Santa Clara', referencia:'Ao lado da Escola Municipal', foto:null, status:'Resolvida', criadoEm:'2025-12-15T09:00:00.000Z', atualizadoEm:'2025-12-20T16:00:00.000Z', historico:[{status:'Recebida',data:'2025-12-15T09:00:00.000Z',obs:'Registrada'},{status:'Resolvida',data:'2025-12-20T16:00:00.000Z',obs:'Área limpa'}], mensagens:[], lat:-28.2815, lng:-49.1655, apoios:[], avaliacao:{nota:5,comentario:'Ficou ótimo, rápido demais!',data:'2025-12-21T10:00:00.000Z'} }
    ],
    sessions: {},
    nextProtocolo: 4,
    chatMensagens: []
  };
  saveJsonDB();
}

function saveJsonDB() {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(jsonDB, null, 2)); } catch {}
}

function hash(str) { return crypto.createHash('sha256').update(str).digest('hex'); }
function genToken() { return crypto.randomBytes(32).toString('hex'); }

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

const db = {
  async findUser(email) {
    if (usePostgres) {
      const r = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
      if (!r.rows[0]) return null;
      const u = r.rows[0];
      return { id:u.id, nome:u.nome, email:u.email, senha:u.senha, role:u.role, bairro:u.bairro, termosAceitosEm:u.termos_aceitos_em, foto:u.foto, premium:!!u.premium };
    }
    return jsonDB.users.find(u => u.email === email) || null;
  },
  async findUserById(id) {
    if (usePostgres) {
      const r = await pool.query('SELECT * FROM users WHERE id=$1', [id]);
      if (!r.rows[0]) return null;
      const u = r.rows[0];
      return { id:u.id, nome:u.nome, email:u.email, senha:u.senha, role:u.role, bairro:u.bairro, termosAceitosEm:u.termos_aceitos_em, foto:u.foto, premium:!!u.premium };
    }
    return jsonDB.users.find(u => u.id === id) || null;
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
      const r = await pool.query(`SELECT COUNT(*) FROM ocorrencias WHERE apoios @> $1::jsonb`, [JSON.stringify([userId])]);
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
  async createSession(token, userId) {
    if (usePostgres) {
      await pool.query('INSERT INTO sessions (token,user_id) VALUES ($1,$2)', [token, userId]);
      return;
    }
    jsonDB.sessions[token] = { userId }; saveJsonDB();
  },
  async getSession(token) {
    if (usePostgres) {
      const r = await pool.query('SELECT user_id FROM sessions WHERE token=$1', [token]);
      return r.rows[0] ? { userId: r.rows[0].user_id } : null;
    }
    return jsonDB.sessions[token] || null;
  },
  async deleteSession(token) {
    if (usePostgres) {
      await pool.query('DELETE FROM sessions WHERE token=$1', [token]); return;
    }
    delete jsonDB.sessions[token]; saveJsonDB();
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
      return r.rows.map(o => ({
        id:o.id, protocolo:o.protocolo, userId:o.user_id, titulo:o.titulo, descricao:o.descricao,
        categoria:o.categoria, endereco:o.endereco, bairro:o.bairro, referencia:o.referencia,
        foto:o.foto, status:o.status, criadoEm:o.criado_em, atualizadoEm:o.atualizado_em,
        historico:o.historico||[], mensagens:o.mensagens||[], nomeUsuario:o.nome_usuario||'–',
        lat:o.lat, lng:o.lng, apoios:o.apoios||[], avaliacao:o.avaliacao||null
      }));
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
    return lista.sort((a,b) => new Date(b.criadoEm)-new Date(a.criadoEm));
  },
  async getOcorrencia(id) {
    if (usePostgres) {
      const r = await pool.query(`SELECT o.*, u.nome as nome_usuario FROM ocorrencias o LEFT JOIN users u ON o.user_id=u.id WHERE o.id=$1`, [id]);
      if (!r.rows[0]) return null;
      const o = r.rows[0];
      return { id:o.id, protocolo:o.protocolo, userId:o.user_id, titulo:o.titulo, descricao:o.descricao, categoria:o.categoria, endereco:o.endereco, bairro:o.bairro, referencia:o.referencia, foto:o.foto, status:o.status, criadoEm:o.criado_em, atualizadoEm:o.atualizado_em, historico:o.historico||[], mensagens:o.mensagens||[], nomeUsuario:o.nome_usuario||'–', lat:o.lat, lng:o.lng, apoios:o.apoios||[], avaliacao:o.avaliacao||null };
    }
    const o = jsonDB.ocorrencias.find(o => o.id === id);
    if (!o) return null;
    const u = jsonDB.users.find(u => u.id === o.userId);
    return { ...o, nomeUsuario: u?.nome || '–' };
  },
  async createOcorrencia(oc) {
    if (usePostgres) {
      await pool.query(`INSERT INTO ocorrencias (id,protocolo,user_id,titulo,descricao,categoria,endereco,bairro,referencia,foto,status,criado_em,atualizado_em,historico,mensagens,lat,lng,apoios) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,$13,$14,$15,$16,$17)`,
        [oc.id, oc.protocolo, oc.userId, oc.titulo, oc.descricao, oc.categoria, oc.endereco, oc.bairro, oc.referencia, oc.foto, oc.status, oc.criadoEm, JSON.stringify(oc.historico), JSON.stringify(oc.mensagens), oc.lat ?? null, oc.lng ?? null, JSON.stringify(oc.apoios || [])]);
      return;
    }
    jsonDB.ocorrencias.push(oc); saveJsonDB();
  },
  async toggleApoio(id, userId) {
    if (usePostgres) {
      const r = await pool.query('SELECT apoios FROM ocorrencias WHERE id=$1', [id]);
      if (!r.rows[0]) return null;
      let apoios = r.rows[0].apoios || [];
      const already = apoios.includes(userId);
      apoios = already ? apoios.filter(u => u !== userId) : [...apoios, userId];
      await pool.query('UPDATE ocorrencias SET apoios=$1 WHERE id=$2', [JSON.stringify(apoios), id]);
      return { apoiado: !already, total: apoios.length };
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
  async updateStatus(id, status, obs, setor, mensagem) {
    const agora = new Date().toISOString();
    if (usePostgres) {
      const r = await pool.query('SELECT historico, mensagens FROM ocorrencias WHERE id=$1', [id]);
      if (!r.rows[0]) return false;
      const hist = r.rows[0].historico || [];
      hist.push({ status, data: agora, obs: obs || `Status alterado para ${status}`, setor: setor || null });
      const msgs = r.rows[0].mensagens || [];
      if (mensagem) msgs.push({ de:'prefeitura', texto:mensagem, data:agora });
      await pool.query('UPDATE ocorrencias SET status=$1, atualizado_em=$2, historico=$3, mensagens=$4 WHERE id=$5',
        [status, agora, JSON.stringify(hist), JSON.stringify(msgs), id]);
      return true;
    }
    const idx = jsonDB.ocorrencias.findIndex(o => o.id === id);
    if (idx === -1) return false;
    jsonDB.ocorrencias[idx].status = status;
    jsonDB.ocorrencias[idx].atualizadoEm = agora;
    jsonDB.ocorrencias[idx].historico.push({ status, data:agora, obs:obs||`Status alterado para ${status}`, setor:setor||null });
    if (mensagem) jsonDB.ocorrencias[idx].mensagens.push({ de:'prefeitura', texto:mensagem, data:agora });
    saveJsonDB();
    return true;
  },
  async getStats() {
    if (usePostgres) {
      const total = await pool.query('SELECT COUNT(*) FROM ocorrencias');
      const byStatus = await pool.query(`SELECT status, COUNT(*) as n FROM ocorrencias GROUP BY status`);
      const byCat = await pool.query(`SELECT categoria, COUNT(*) as n FROM ocorrencias GROUP BY categoria ORDER BY n DESC`);
      const byBairro = await pool.query(`SELECT bairro, COUNT(*) as n FROM ocorrencias GROUP BY bairro ORDER BY n DESC LIMIT 5`);
      const sm = {}; byStatus.rows.forEach(r => sm[r.status] = parseInt(r.n));
      return {
        total: parseInt(total.rows[0].count),
        recebida: sm['Recebida']||0, analise: sm['Em análise']||0,
        encaminhada: sm['Encaminhada']||0, atendimento: sm['Em atendimento']||0, resolvida: sm['Resolvida']||0,
        categorias: byCat.rows.map(r => [r.categoria, parseInt(r.n)]),
        bairros: byBairro.rows.map(r => [r.bairro, parseInt(r.n)])
      };
    }
    const ocs = jsonDB.ocorrencias;
    const catMap = {}, bairroMap = {};
    ocs.forEach(o => { catMap[o.categoria]=(catMap[o.categoria]||0)+1; bairroMap[o.bairro]=(bairroMap[o.bairro]||0)+1; });
    return {
      total: ocs.length,
      recebida: ocs.filter(o=>o.status==='Recebida').length,
      analise: ocs.filter(o=>o.status==='Em análise').length,
      encaminhada: ocs.filter(o=>o.status==='Encaminhada').length,
      atendimento: ocs.filter(o=>o.status==='Em atendimento').length,
      resolvida: ocs.filter(o=>o.status==='Resolvida').length,
      categorias: Object.entries(catMap).sort((a,b)=>b[1]-a[1]),
      bairros: Object.entries(bairroMap).sort((a,b)=>b[1]-a[1]).slice(0,5)
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
  }
};

function parseBody(req) {
  return new Promise((res,rej) => {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 10e6) req.destroy(); });
    req.on('end', () => { try { res(JSON.parse(body||'{}')); } catch { res({}); } });
    req.on('error', rej);
  });
}

function json(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'Content-Type,Authorization', 'Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS' });
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
    res.writeHead(204, { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'Content-Type,Authorization', 'Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS' });
    return res.end();
  }

  if (req.method === 'GET' && !pathname.startsWith('/api/')) {
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(__dirname, 'public', filePath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
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
          res.writeHead(416, { 'Content-Range': `bytes */${size}` });
          return res.end();
        }
        res.writeHead(206, {
          'Content-Type': contentType,
          'Content-Length': end - start + 1,
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Accept-Ranges': 'bytes'
        });
        return fs.createReadStream(filePath, { start, end }).pipe(res);
      }

      res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': size, 'Accept-Ranges': 'bytes' });
      return fs.createReadStream(filePath).pipe(res);
    }
    const idx = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(idx)) { res.writeHead(200, { 'Content-Type':'text/html' }); return fs.createReadStream(idx).pipe(res); }
    return json(res, 404, { erro: 'Não encontrado' });
  }

  try {
    if (pathname === '/api/cadastro' && req.method === 'POST') {
      const { nome, email, senha, bairro } = await parseBody(req);
      if (!nome?.trim() || !email?.trim() || !senha) return json(res, 400, { erro:'Preencha todos os campos.' });
      if (senha.length < 6) return json(res, 400, { erro:'Senha deve ter no mínimo 6 caracteres.' });
      if (await db.emailExists(email.trim())) return json(res, 400, { erro:'E-mail já cadastrado.' });
      await db.createUser({ id:'u'+Date.now(), nome:nome.trim(), email:email.trim().toLowerCase(), senha:hash(senha), role:'morador', bairro:bairro||'', foto:null, premium:false });
      return json(res, 201, { ok:true });
    }

    if (pathname === '/api/login' && req.method === 'POST') {
      const { email, senha } = await parseBody(req);
      const user = await db.findUser(email?.trim().toLowerCase());
      if (!user || user.senha !== hash(senha)) return json(res, 401, { erro:'E-mail ou senha incorretos.' });
      const token = genToken();
      await db.createSession(token, user.id);
      return json(res, 200, { token, role:user.role, nome:user.nome, email:user.email, id:user.id, termosAceitos: !!user.termosAceitosEm, foto:user.foto||null, premium: !!user.premium });
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
        nome:user.nome, email:user.email, foto:user.foto||null, premium: !!user.premium,
        stats: { ocorrencias: minhas.length, resolvidas, apoiosDados }
      });
    }

    if (pathname === '/api/perfil' && req.method === 'PUT') {
      const user = await authUser(req);
      if (!user) return json(res, 401, { erro:'Não autenticado.' });
      const { nome, foto } = await parseBody(req);
      const upd = {};
      if (nome !== undefined) {
        if (!nome.trim()) return json(res, 400, { erro:'Nome não pode ficar em branco.' });
        upd.nome = nome.trim();
      }
      if (foto !== undefined) upd.foto = foto;
      await db.updatePerfil(user.id, upd);
      return json(res, 200, { ok:true });
    }

    if (pathname === '/api/chat-premium' && req.method === 'GET') {
      const user = await authUser(req);
      if (!user) return json(res, 401, { erro:'Não autenticado.' });
      return json(res, 200, await db.listChatMensagens());
    }

    if (pathname === '/api/chat-premium' && req.method === 'POST') {
      const user = await authUser(req);
      if (!user) return json(res, 401, { erro:'Não autenticado.' });
      const { texto } = await parseBody(req);
      if (!texto?.trim()) return json(res, 400, { erro:'Mensagem vazia.' });
      const msg = { id:'msg'+Date.now()+Math.random().toString(36).slice(2,7), userId:user.id, nome:user.nome, texto:texto.trim().slice(0,500), criadoEm:new Date().toISOString() };
      await db.addChatMensagem(msg);
      return json(res, 201, { ok:true });
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
      const { titulo, descricao, categoria, endereco, bairro, referencia, foto, lat, lng } = await parseBody(req);
      if (!titulo?.trim() || !categoria || !endereco?.trim() || !bairro) return json(res, 400, { erro:'Preencha os campos obrigatórios.' });
      const protocolo = await gerarProtocolo();
      const agora = new Date().toISOString();
      const oc = { id:'oc'+Date.now(), protocolo, userId:user.id, titulo:titulo.trim(), descricao:descricao||'', categoria, endereco:endereco.trim(), bairro, referencia:referencia||'', foto:foto||null, status:'Recebida', criadoEm:agora, atualizadoEm:agora, historico:[{status:'Recebida',data:agora,obs:'Ocorrência registrada pelo cidadão'}], mensagens:[], lat: typeof lat === 'number' ? lat : null, lng: typeof lng === 'number' ? lng : null, apoios:[], avaliacao:null };
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
      const { status, obs, setor, mensagem } = await parseBody(req);
      const ok = await db.updateStatus(matchUpd[1], status, obs, setor, mensagem);
      if (!ok) return json(res, 404, { erro:'Não encontrada.' });
      return json(res, 200, { ok:true });
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
      const avaliacao = await db.avaliar(matchAval[1], n, comentario);
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
        nomeUsuario: user.role === 'admin' ? o.nomeUsuario : null
      }));
      return json(res, 200, pontos);
    }

    if (pathname === '/api/upload' && req.method === 'POST') {
      const user = await authUser(req);
      if (!user) return json(res, 401, { erro:'Não autenticado.' });
      const { data } = await parseBody(req);
      if (!data) return json(res, 400, { erro:'Sem dados.' });
      const uploadDir = path.join(__dirname, 'public', 'uploads');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive:true });
      const nomeArq = `foto_${Date.now()}.jpg`;
      const base64 = data.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(path.join(uploadDir, nomeArq), Buffer.from(base64, 'base64'));
      return json(res, 200, { url:`/uploads/${nomeArq}` });
    }

    json(res, 404, { erro:'Rota não encontrada.' });
  } catch (e) {
    console.error('Erro:', e.message);
    json(res, 500, { erro:'Erro interno do servidor.' });
  }
});

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
