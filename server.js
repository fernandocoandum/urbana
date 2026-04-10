const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;

// ── BANCO: usa PostgreSQL se disponível, senão JSON local ──────────
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
          criado_em TIMESTAMPTZ DEFAULT NOW()
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
          mensagens JSONB DEFAULT '[]'
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
      `);
      // seed admin
      const adminHash = hash('admin');
      await pool.query(`
        INSERT INTO users (id, nome, email, senha, role) 
        VALUES ('u1','Admin Prefeitura','admin@prefeitura.gov.br',$1,'admin')
        ON CONFLICT (email) DO NOTHING
      `, [adminHash]);
      // seed protocolo counter
      await pool.query(`INSERT INTO config (key,value) VALUES ('next_protocolo','4') ON CONFLICT (key) DO NOTHING`);
      // seed ocorrências de exemplo
      await seedExamples();
      usePostgres = true;
      console.log('  ✅  Banco PostgreSQL conectado');
    } catch (e) {
      console.log('  ⚠️  PostgreSQL falhou, usando JSON local:', e.message);
      usePostgres = false;
      initJsonDB();
    }
  } else {
    console.log('  📁  Usando banco JSON local (db.json)');
    initJsonDB();
  }
}

async function seedExamples() {
  const count = await pool.query('SELECT COUNT(*) FROM ocorrencias');
  if (parseInt(count.rows[0].count) > 0) return;
  const examples = [
    ['oc1','PROT-2026-0001','u1','Buraco na Rua João Machado','Buraco de aproximadamente 80cm de diâmetro na pista principal.','Pavimentação','Rua João Machado, 450','Centro','Em frente à padaria Pão de Mel','Em atendimento','2026-01-02T14:32:00Z',
      JSON.stringify([{status:'Recebida',data:'2026-01-02T14:32:00Z',obs:'Registrada pelo cidadão'},{status:'Em análise',data:'2026-01-03T09:15:00Z',obs:'Avaliação técnica iniciada'},{status:'Encaminhada',data:'2026-01-03T16:48:00Z',obs:'Encaminhada para Secretaria de Obras'},{status:'Em atendimento',data:'2026-01-05T08:00:00Z',obs:'Equipe de campo em ação'}])],
    ['oc2','PROT-2026-0002','u1','Poste sem iluminação — Av. Principal','Poste apagado há mais de uma semana.','Iluminação pública','Av. Principal, 1200','Centro','Próximo ao Banco do Brasil','Em análise','2026-01-05T10:00:00Z',
      JSON.stringify([{status:'Recebida',data:'2026-01-05T10:00:00Z',obs:'Registrada'},{status:'Em análise',data:'2026-01-06T09:00:00Z',obs:'Verificação técnica agendada'}])],
    ['oc3','PROT-2026-0003','u1','Descarte irregular — Loteamento Santa Clara','Lixo e entulho descartados irregularmente.','Limpeza urbana','Estrada Santa Clara, s/n','Santa Clara','Ao lado da Escola Municipal','Resolvida','2025-12-15T09:00:00Z',
      JSON.stringify([{status:'Recebida',data:'2025-12-15T09:00:00Z',obs:'Registrada'},{status:'Em análise',data:'2025-12-16T10:00:00Z',obs:'Vistoria realizada'},{status:'Em atendimento',data:'2025-12-18T08:00:00Z',obs:'Equipe de limpeza acionada'},{status:'Resolvida',data:'2025-12-20T16:00:00Z',obs:'Área limpa e desobstruída'}])]
  ];
  for (const [id,protocolo,user_id,titulo,descricao,categoria,endereco,bairro,referencia,status,criado_em,historico] of examples) {
    await pool.query(`INSERT INTO ocorrencias (id,protocolo,user_id,titulo,descricao,categoria,endereco,bairro,referencia,status,criado_em,atualizado_em,historico) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12) ON CONFLICT DO NOTHING`,
      [id,protocolo,user_id,titulo,descricao,categoria,endereco,bairro,referencia,status,criado_em,historico]);
  }
  await pool.query(`UPDATE config SET value='4' WHERE key='next_protocolo'`);
}

// ── JSON LOCAL ──────────────────────────────────────────────────────
const DB_FILE = path.join(__dirname, 'db.json');
let jsonDB = null;

function initJsonDB() {
  if (fs.existsSync(DB_FILE)) {
    try { jsonDB = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); return; } catch {}
  }
  jsonDB = {
    users: [{ id:'u1', nome:'Admin Prefeitura', email:'admin@prefeitura.gov.br', senha:hash('admin'), role:'admin', bairro:'', criadoEm:'2026-01-01T00:00:00.000Z' }],
    ocorrencias: [
      { id:'oc1', protocolo:'PROT-2026-0001', userId:'u1', titulo:'Buraco na Rua João Machado', descricao:'Buraco de aproximadamente 80cm de diâmetro na pista principal.', categoria:'Pavimentação', endereco:'Rua João Machado, 450', bairro:'Centro', referencia:'Em frente à padaria Pão de Mel', foto:null, status:'Em atendimento', criadoEm:'2026-01-02T14:32:00.000Z', atualizadoEm:'2026-01-05T08:00:00.000Z', historico:[{status:'Recebida',data:'2026-01-02T14:32:00.000Z',obs:'Registrada pelo cidadão'},{status:'Em análise',data:'2026-01-03T09:15:00.000Z',obs:'Avaliação técnica iniciada'},{status:'Encaminhada',data:'2026-01-03T16:48:00.000Z',obs:'Encaminhada para Secretaria de Obras'},{status:'Em atendimento',data:'2026-01-05T08:00:00.000Z',obs:'Equipe de campo em ação'}], mensagens:[] },
      { id:'oc2', protocolo:'PROT-2026-0002', userId:'u1', titulo:'Poste sem iluminação — Av. Principal', descricao:'Poste apagado há mais de uma semana.', categoria:'Iluminação pública', endereco:'Av. Principal, 1200', bairro:'Centro', referencia:'Próximo ao Banco do Brasil', foto:null, status:'Em análise', criadoEm:'2026-01-05T10:00:00.000Z', atualizadoEm:'2026-01-06T09:00:00.000Z', historico:[{status:'Recebida',data:'2026-01-05T10:00:00.000Z',obs:'Registrada'},{status:'Em análise',data:'2026-01-06T09:00:00.000Z',obs:'Verificação agendada'}], mensagens:[] },
      { id:'oc3', protocolo:'PROT-2026-0003', userId:'u1', titulo:'Descarte irregular — Santa Clara', descricao:'Lixo e entulho descartados irregularmente.', categoria:'Limpeza urbana', endereco:'Estrada Santa Clara, s/n', bairro:'Santa Clara', referencia:'Ao lado da Escola Municipal', foto:null, status:'Resolvida', criadoEm:'2025-12-15T09:00:00.000Z', atualizadoEm:'2025-12-20T16:00:00.000Z', historico:[{status:'Recebida',data:'2025-12-15T09:00:00.000Z',obs:'Registrada'},{status:'Resolvida',data:'2025-12-20T16:00:00.000Z',obs:'Área limpa'}], mensagens:[] }
    ],
    sessions: {},
    nextProtocolo: 4
  };
  saveJsonDB();
}

function saveJsonDB() {
  try { fs.writeFileSync(DB_FILE, JSON.stringify(jsonDB, null, 2)); } catch {}
}

// ── HELPERS ─────────────────────────────────────────────────────────
function hash(str) { return crypto.createHash('sha256').update(str).digest('hex'); }
function genToken() { return crypto.randomBytes(32).toString('hex'); }

async function gerarProtocolo() {
  if (usePostgres) {
    const r = await pool.query(`UPDATE config SET value=(value::int+1)::text WHERE key='next_protocolo' RETURNING value`);
    const n = String(parseInt(r.rows[0].value) - 1).padStart(4,'0');
    return `PROT-2026-${n}`;
  }
  const n = String(jsonDB.nextProtocolo).padStart(4,'0');
  jsonDB.nextProtocolo++;
  saveJsonDB();
  return `PROT-2026-${n}`;
}

// ── DB ABSTRACTION ───────────────────────────────────────────────────
const db = {
  async findUser(email) {
    if (usePostgres) {
      const r = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
      if (!r.rows[0]) return null;
      const u = r.rows[0];
      return { id:u.id, nome:u.nome, email:u.email, senha:u.senha, role:u.role, bairro:u.bairro };
    }
    return jsonDB.users.find(u => u.email === email) || null;
  },
  async findUserById(id) {
    if (usePostgres) {
      const r = await pool.query('SELECT * FROM users WHERE id=$1', [id]);
      if (!r.rows[0]) return null;
      const u = r.rows[0];
      return { id:u.id, nome:u.nome, email:u.email, senha:u.senha, role:u.role, bairro:u.bairro };
    }
    return jsonDB.users.find(u => u.id === id) || null;
  },
  async createUser(user) {
    if (usePostgres) {
      await pool.query('INSERT INTO users (id,nome,email,senha,role,bairro) VALUES ($1,$2,$3,$4,$5,$6)',
        [user.id, user.nome, user.email, user.senha, user.role, user.bairro]);
      return;
    }
    jsonDB.users.push(user); saveJsonDB();
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
        historico:o.historico||[], mensagens:o.mensagens||[], nomeUsuario:o.nome_usuario||'–'
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
      return { id:o.id, protocolo:o.protocolo, userId:o.user_id, titulo:o.titulo, descricao:o.descricao, categoria:o.categoria, endereco:o.endereco, bairro:o.bairro, referencia:o.referencia, foto:o.foto, status:o.status, criadoEm:o.criado_em, atualizadoEm:o.atualizado_em, historico:o.historico||[], mensagens:o.mensagens||[], nomeUsuario:o.nome_usuario||'–' };
    }
    const o = jsonDB.ocorrencias.find(o => o.id === id);
    if (!o) return null;
    const u = jsonDB.users.find(u => u.id === o.userId);
    return { ...o, nomeUsuario: u?.nome || '–' };
  },
  async createOcorrencia(oc) {
    if (usePostgres) {
      await pool.query(`INSERT INTO ocorrencias (id,protocolo,user_id,titulo,descricao,categoria,endereco,bairro,referencia,foto,status,criado_em,atualizado_em,historico,mensagens) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,$13,$14)`,
        [oc.id, oc.protocolo, oc.userId, oc.titulo, oc.descricao, oc.categoria, oc.endereco, oc.bairro, oc.referencia, oc.foto, oc.status, oc.criadoEm, JSON.stringify(oc.historico), JSON.stringify(oc.mensagens)]);
      return;
    }
    jsonDB.ocorrencias.push(oc); saveJsonDB();
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
  }
};

// ── HTTP HELPERS ─────────────────────────────────────────────────────
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

// ── SERVIDOR ─────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'Content-Type,Authorization', 'Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS' });
    return res.end();
  }

  // Arquivos estáticos
  if (req.method === 'GET' && !pathname.startsWith('/api/')) {
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(__dirname, 'public', filePath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      const mime = { '.html':'text/html', '.css':'text/css', '.js':'application/javascript', '.png':'image/png', '.jpg':'image/jpeg', '.gif':'image/gif', '.svg':'image/svg+xml', '.webp':'image/webp' };
      res.writeHead(200, { 'Content-Type': mime[ext]||'application/octet-stream' });
      return fs.createReadStream(filePath).pipe(res);
    }
    const idx = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(idx)) { res.writeHead(200, { 'Content-Type':'text/html' }); return fs.createReadStream(idx).pipe(res); }
    return json(res, 404, { erro: 'Não encontrado' });
  }

  try {
    // CADASTRO
    if (pathname === '/api/cadastro' && req.method === 'POST') {
      const { nome, email, senha, bairro } = await parseBody(req);
      if (!nome?.trim() || !email?.trim() || !senha) return json(res, 400, { erro:'Preencha todos os campos.' });
      if (senha.length < 6) return json(res, 400, { erro:'Senha deve ter no mínimo 6 caracteres.' });
      if (await db.emailExists(email.trim())) return json(res, 400, { erro:'E-mail já cadastrado.' });
      await db.createUser({ id:'u'+Date.now(), nome:nome.trim(), email:email.trim().toLowerCase(), senha:hash(senha), role:'morador', bairro:bairro||'' });
      return json(res, 201, { ok:true });
    }

    // LOGIN
    if (pathname === '/api/login' && req.method === 'POST') {
      const { email, senha } = await parseBody(req);
      const user = await db.findUser(email?.trim().toLowerCase());
      if (!user || user.senha !== hash(senha)) return json(res, 401, { erro:'E-mail ou senha incorretos.' });
      const token = genToken();
      await db.createSession(token, user.id);
      return json(res, 200, { token, role:user.role, nome:user.nome, email:user.email, id:user.id });
    }

    // LOGOUT
    if (pathname === '/api/logout' && req.method === 'POST') {
      const token = getToken(req);
      if (token) await db.deleteSession(token);
      return json(res, 200, { ok:true });
    }

    // ME
    if (pathname === '/api/me' && req.method === 'GET') {
      const user = await authUser(req);
      if (!user) return json(res, 401, { erro:'Não autenticado.' });
      const { senha, ...safe } = user;
      return json(res, 200, safe);
    }

    // STATS (público para landing)
    if (pathname === '/api/stats' && req.method === 'GET') {
      const user = await authUser(req);
      const stats = await db.getStats();
      if (!user || user.role !== 'admin') {
        return json(res, 200, { total:stats.total, resolvida:stats.resolvida, atendimento:stats.atendimento, analise:stats.analise });
      }
      return json(res, 200, stats);
    }

    // LISTAR OCORRÊNCIAS
    if (pathname === '/api/ocorrencias' && req.method === 'GET') {
      const user = await authUser(req);
      if (!user) return json(res, 401, { erro:'Não autenticado.' });
      const filters = user.role === 'morador'
        ? { userId: user.id }
        : { status: url.searchParams.get('status'), categoria: url.searchParams.get('categoria'), bairro: url.searchParams.get('bairro'), busca: url.searchParams.get('busca') };
      return json(res, 200, await db.listOcorrencias(filters));
    }

    // CRIAR OCORRÊNCIA
    if (pathname === '/api/ocorrencias' && req.method === 'POST') {
      const user = await authUser(req);
      if (!user) return json(res, 401, { erro:'Não autenticado.' });
      const { titulo, descricao, categoria, endereco, bairro, referencia, foto } = await parseBody(req);
      if (!titulo?.trim() || !categoria || !endereco?.trim() || !bairro) return json(res, 400, { erro:'Preencha os campos obrigatórios.' });
      const protocolo = await gerarProtocolo();
      const agora = new Date().toISOString();
      const oc = { id:'oc'+Date.now(), protocolo, userId:user.id, titulo:titulo.trim(), descricao:descricao||'', categoria, endereco:endereco.trim(), bairro, referencia:referencia||'', foto:foto||null, status:'Recebida', criadoEm:agora, atualizadoEm:agora, historico:[{status:'Recebida',data:agora,obs:'Ocorrência registrada pelo cidadão'}], mensagens:[] };
      await db.createOcorrencia(oc);
      return json(res, 201, { ok:true, protocolo, id:oc.id });
    }

    // DETALHE
    const matchDet = pathname.match(/^\/api\/ocorrencias\/([^/]+)$/);
    if (matchDet && req.method === 'GET') {
      const user = await authUser(req);
      if (!user) return json(res, 401, { erro:'Não autenticado.' });
      const oc = await db.getOcorrencia(matchDet[1]);
      if (!oc) return json(res, 404, { erro:'Não encontrada.' });
      if (user.role === 'morador' && oc.userId !== user.id) return json(res, 403, { erro:'Sem permissão.' });
      return json(res, 200, oc);
    }

    // ATUALIZAR STATUS
    const matchUpd = pathname.match(/^\/api\/ocorrencias\/([^/]+)\/status$/);
    if (matchUpd && req.method === 'PUT') {
      const user = await authUser(req);
      if (!user || user.role !== 'admin') return json(res, 403, { erro:'Acesso negado.' });
      const { status, obs, setor, mensagem } = await parseBody(req);
      const ok = await db.updateStatus(matchUpd[1], status, obs, setor, mensagem);
      if (!ok) return json(res, 404, { erro:'Não encontrada.' });
      return json(res, 200, { ok:true });
    }

    // UPLOAD FOTO
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

// ── START ─────────────────────────────────────────────────────────────
initDB().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('  ✅  Servidor Urbana rodando!');
    console.log(`  🌐  http://localhost:${PORT}`);
    console.log('');
    console.log('  Login admin: admin@prefeitura.gov.br / admin');
    console.log('');
  });
});
