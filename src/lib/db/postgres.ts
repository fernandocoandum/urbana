import crypto from 'node:crypto';
import { Pool } from 'pg';
import { computeDerivedFields } from '@/features/ocorrencias/derived';
import { env, isProdIntent } from '@/lib/env';
import { hashPassword } from '@/lib/crypto';
import { APOIOS_TABLE_SQL, SCHEMA_SQL } from './schema';
import { anoAtualBR } from './util';
import type {
  Avaliacao, ChatMsg, Db, ListFilters, Mensagem, Ocorrencia, OcorrenciaDerivada, PedidoReabertura,
  Stats, StatusOpts, User,
} from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

function mapUser(u: Row): User {
  return { id:u.id, nome:u.nome, email:u.email, senha:u.senha, role:u.role, bairro:u.bairro, termosAceitosEm:u.termos_aceitos_em, foto:u.foto, criadoEm:u.criado_em };
}

export function mapOcorrenciaPg(o: Row, apoios: string[]): OcorrenciaDerivada {
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

export class PgDb implements Db {
  private constructor(private pool: Pool) {}

  /** Cria o pool, roda o DDL aditivo, garante admin, protocolo e seed. Lança em caso de falha. */
  static async init(): Promise<PgDb> {
    const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    pool.on('error', (e) => console.error('Erro em conexão ociosa do pool PostgreSQL:', e.message));
    try {
      await pool.query(SCHEMA_SQL);
      const db = new PgDb(pool);
      await db.ensureApoiosTable();
      await db.ensureAdminAccount();
      await pool.query(`INSERT INTO config (key,value) VALUES ('next_protocolo','4') ON CONFLICT (key) DO NOTHING`);
      await db.seedExamples();
      console.log('Banco PostgreSQL conectado');
      return db;
    } catch (e) {
      await pool.end().catch(() => {});
      throw e;
    }
  }

  private async ensureAdminAccount() {
    const pool = this.pool;
    const email = (env.ADMIN_EMAIL || 'admin@prefeitura.gov.br').trim().toLowerCase();
    const nome = env.ADMIN_NOME || 'Admin Prefeitura';
    const senhaEnv = env.ADMIN_SENHA;
    const existente = (await pool.query('SELECT id FROM users WHERE email=$1', [email])).rows[0];

    if (senhaEnv) {
      const hash = hashPassword(senhaEnv);
      if (existente) {
        await pool.query('UPDATE users SET senha=$1 WHERE email=$2', [hash, email]);
        console.log(`Senha da conta administrativa (${email}) sincronizada com ADMIN_SENHA.`);
      } else {
        const novo = { id:'u1', nome, email, senha:hash, role:'admin', bairro:'', foto:null };
        await pool.query('INSERT INTO users (id,nome,email,senha,role,termos_aceitos_em) VALUES ($1,$2,$3,$4,$5,NOW())', [novo.id, novo.nome, novo.email, novo.senha, novo.role]);
        console.log(`Conta administrativa criada: ${email} (senha definida por ADMIN_SENHA).`);
      }
      return;
    }

    if (existente) return; // conta já existe e nenhuma senha nova foi solicitada — não mexe nela

    const senhaGerada = isProdIntent() ? crypto.randomBytes(9).toString('base64url') : 'admin';
    const hash = hashPassword(senhaGerada);
    const novo = { id:'u1', nome, email, senha:hash, role:'admin', bairro:'', foto:null };
    await pool.query('INSERT INTO users (id,nome,email,senha,role,termos_aceitos_em) VALUES ($1,$2,$3,$4,$5,NOW())', [novo.id, novo.nome, novo.email, novo.senha, novo.role]);

    if (isProdIntent()) {
      console.log('========================================================');
      console.log(`Conta administrativa criada automaticamente: ${email}`);
      console.log(`Senha temporária gerada (defina ADMIN_SENHA para fixar uma própria): ${senhaGerada}`);
      console.log('Troque essa senha assim que possível (ou defina ADMIN_SENHA e reimplante).');
      console.log('========================================================');
    } else {
      console.log(`Modo de desenvolvimento: conta administrativa ${email} / senha "admin" (apenas local).`);
    }
  }

  private async ensureApoiosTable() {
    // Tabela normalizada de apoios com unicidade (ocorrencia,usuário) — evita leitura+gravação
    // do array inteiro de apoios sob concorrência, que pode perder incrementos simultâneos.
    await this.pool.query(APOIOS_TABLE_SQL);
    // Migra apoios já armazenados no array JSONB legado, se houver, para a tabela normalizada.
    const r = await this.pool.query(`SELECT id, apoios FROM ocorrencias WHERE apoios IS NOT NULL AND jsonb_array_length(apoios) > 0`);
    for (const row of r.rows) {
      for (const uid of row.apoios) {
        await this.pool.query('INSERT INTO apoios_registro (ocorrencia_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [row.id, uid]);
      }
    }
  }

  private async seedExamples() {
    const pool = this.pool;
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

  async gerarProtocolo() {
    const ano = anoAtualBR();
    const r = await this.pool.query(`UPDATE config SET value=(value::int+1)::text WHERE key='next_protocolo' RETURNING value`);
    const n = String(parseInt(r.rows[0].value) - 1).padStart(4,'0');
    return `PROT-${ano}-${n}`;
  }

  private async getApoiosMap(ids: string[]): Promise<Record<string, string[]>> {
    if (!ids.length) return {};
    const r = await this.pool.query('SELECT ocorrencia_id, user_id FROM apoios_registro WHERE ocorrencia_id = ANY($1)', [ids]);
    const map: Record<string, string[]> = {};
    for (const row of r.rows) { (map[row.ocorrencia_id] = map[row.ocorrencia_id] || []).push(row.user_id); }
    return map;
  }

  async findUser(email: string) {
    const r = await this.pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (!r.rows[0]) return null;
    return mapUser(r.rows[0]);
  }
  async findUserById(id: string) {
    const r = await this.pool.query('SELECT * FROM users WHERE id=$1', [id]);
    if (!r.rows[0]) return null;
    return mapUser(r.rows[0]);
  }
  async setResetToken(email: string, tokenHash: string, expiraEm: string) {
    await this.pool.query('UPDATE users SET reset_token=$1, reset_expira_em=$2 WHERE email=$3', [tokenHash, expiraEm, email]);
  }
  async findUserByResetTokenHash(tokenHash: string) {
    const agora = Date.now();
    const r = await this.pool.query('SELECT * FROM users WHERE reset_token=$1', [tokenHash]);
    const u = r.rows[0];
    if (!u || !u.reset_expira_em || new Date(u.reset_expira_em).getTime() < agora) return null;
    return { id:u.id, nome:u.nome, email:u.email };
  }
  async clearResetToken(userId: string) {
    await this.pool.query('UPDATE users SET reset_token=NULL, reset_expira_em=NULL WHERE id=$1', [userId]);
  }
  async deleteAllSessionsForUser(userId: string) {
    await this.pool.query('DELETE FROM sessions WHERE user_id=$1', [userId]);
  }
  async updatePerfil(userId: string, { nome, foto, bairro }: { nome?: string; foto?: string | null; bairro?: string }) {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (nome !== undefined) { params.push(nome); sets.push(`nome=$${params.length}`); }
    if (foto !== undefined) { params.push(foto); sets.push(`foto=$${params.length}`); }
    if (bairro !== undefined) { params.push(bairro); sets.push(`bairro=$${params.length}`); }
    if (!sets.length) return;
    params.push(userId);
    await this.pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id=$${params.length}`, params);
  }
  async contarApoiosDados(userId: string) {
    const r = await this.pool.query('SELECT COUNT(*) FROM apoios_registro WHERE user_id=$1', [userId]);
    return parseInt(r.rows[0].count);
  }
  async createUser(user: User) {
    await this.pool.query('INSERT INTO users (id,nome,email,senha,role,bairro) VALUES ($1,$2,$3,$4,$5,$6)',
      [user.id, user.nome, user.email, user.senha, user.role, user.bairro]);
  }
  async aceitarTermos(userId: string) {
    const agora = new Date().toISOString();
    await this.pool.query('UPDATE users SET termos_aceitos_em=$1 WHERE id=$2', [agora, userId]);
  }
  async emailExists(email: string) {
    const r = await this.pool.query('SELECT id FROM users WHERE email=$1', [email]);
    return r.rows.length > 0;
  }
  async createSession(token: string, userId: string, expiresAt?: number | null) {
    await this.pool.query('INSERT INTO sessions (token,user_id,expira_em) VALUES ($1,$2,$3)', [token, userId, expiresAt ? new Date(expiresAt) : null]);
  }
  async getSession(token: string) {
    const r = await this.pool.query('SELECT user_id, expira_em FROM sessions WHERE token=$1', [token]);
    if (!r.rows[0]) return null;
    if (r.rows[0].expira_em && new Date(r.rows[0].expira_em).getTime() < Date.now()) {
      await this.pool.query('DELETE FROM sessions WHERE token=$1', [token]);
      return null;
    }
    return { userId: r.rows[0].user_id as string };
  }
  async deleteSession(token: string) {
    await this.pool.query('DELETE FROM sessions WHERE token=$1', [token]);
  }
  async updateSenha(userId: string, novoHash: string) {
    await this.pool.query('UPDATE users SET senha=$1 WHERE id=$2', [novoHash, userId]);
  }
  async listOcorrencias(filters: ListFilters = {}) {
    let q = `SELECT o.*, u.nome as nome_usuario FROM ocorrencias o LEFT JOIN users u ON o.user_id=u.id WHERE 1=1`;
    const params: unknown[] = [];
    if (filters.userId) { params.push(filters.userId); q += ` AND o.user_id=$${params.length}`; }
    if (filters.status && filters.status !== 'todos') { params.push(filters.status); q += ` AND o.status=$${params.length}`; }
    if (filters.categoria && filters.categoria !== 'todas') { params.push(filters.categoria); q += ` AND o.categoria=$${params.length}`; }
    if (filters.bairro && filters.bairro !== 'todos') { params.push(filters.bairro); q += ` AND o.bairro=$${params.length}`; }
    if (filters.busca) { params.push(`%${filters.busca}%`); q += ` AND (o.protocolo ILIKE $${params.length} OR o.titulo ILIKE $${params.length} OR o.bairro ILIKE $${params.length})`; }
    q += ' ORDER BY o.criado_em DESC';
    const r = await this.pool.query(q, params);
    const apoiosPorOc = await this.getApoiosMap(r.rows.map((o: Row) => o.id));
    return r.rows.map((o: Row) => mapOcorrenciaPg(o, apoiosPorOc[o.id] || []));
  }
  async getOcorrencia(id: string) {
    const r = await this.pool.query(`SELECT o.*, u.nome as nome_usuario FROM ocorrencias o LEFT JOIN users u ON o.user_id=u.id WHERE o.id=$1`, [id]);
    if (!r.rows[0]) return null;
    const apoios = (await this.pool.query('SELECT user_id FROM apoios_registro WHERE ocorrencia_id=$1', [id])).rows.map((x: Row) => x.user_id as string);
    return mapOcorrenciaPg(r.rows[0], apoios);
  }
  async createOcorrencia(oc: Ocorrencia) {
    await this.pool.query(`INSERT INTO ocorrencias (id,protocolo,user_id,titulo,descricao,categoria,endereco,bairro,referencia,foto,status,criado_em,atualizado_em,historico,mensagens,lat,lng,precisao_local,responsavel,setor,prazo,evidencia_resolucao,pedidos_reabertura) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
      [oc.id, oc.protocolo, oc.userId, oc.titulo, oc.descricao, oc.categoria, oc.endereco, oc.bairro, oc.referencia, oc.foto, oc.status, oc.criadoEm, JSON.stringify(oc.historico), JSON.stringify(oc.mensagens), oc.lat ?? null, oc.lng ?? null, oc.precisaoLocal || 'manual', oc.responsavel || null, oc.setor || null, oc.prazo || null, oc.evidenciaResolucao || null, JSON.stringify(oc.pedidosReabertura || [])]);
  }
  async toggleApoio(id: string, userId: string) {
    // Constraint de unicidade (ocorrencia_id,user_id) evita duplicar apoio mesmo sob concorrência.
    const existing = await this.pool.query('SELECT 1 FROM apoios_registro WHERE ocorrencia_id=$1 AND user_id=$2', [id, userId]);
    const jaApoiava = existing.rows.length > 0;
    if (jaApoiava) await this.pool.query('DELETE FROM apoios_registro WHERE ocorrencia_id=$1 AND user_id=$2', [id, userId]);
    else await this.pool.query('INSERT INTO apoios_registro (ocorrencia_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, userId]);
    const total = await this.pool.query('SELECT COUNT(*) FROM apoios_registro WHERE ocorrencia_id=$1', [id]);
    return { apoiado: !jaApoiava, total: parseInt(total.rows[0].count) };
  }
  async avaliar(id: string, nota: number, comentario: string | undefined): Promise<Avaliacao | null> {
    const agora = new Date().toISOString();
    const avaliacao = { nota, comentario: comentario || '', data: agora };
    const r = await this.pool.query('UPDATE ocorrencias SET avaliacao=$1 WHERE id=$2 RETURNING id', [JSON.stringify(avaliacao), id]);
    return r.rows[0] ? avaliacao : null;
  }
  // opts: { obs, setor, responsavel, prazo, evidencia, tipoEvento }. Mensagens não passam
  // mais por aqui — ver addMensagem(), que é uma rota própria e nunca mexe em status.
  async updateStatus(id: string, status: string, opts: StatusOpts = {}) {
    const { obs, setor, responsavel, prazo, evidencia, tipoEvento } = opts;
    const agora = new Date().toISOString();
    const histEntry: Record<string, unknown> = { status, data: agora, obs: obs || `Status alterado para ${status}`, setor: setor || null };
    if (tipoEvento) histEntry.tipo = tipoEvento; // ex.: 'reabertura', para diferenciar na linha do tempo
    const r = await this.pool.query('SELECT historico, status, evidencia_resolucao FROM ocorrencias WHERE id=$1', [id]);
    if (!r.rows[0]) return false;
    const hist = r.rows[0].historico || [];
    hist.push(histEntry);
    const sets = ['status=$1', 'atualizado_em=$2', 'historico=$3'];
    const params: unknown[] = [status, agora, JSON.stringify(hist)];
    if (setor !== undefined) { params.push(setor); sets.push(`setor=$${params.length}`); }
    if (responsavel !== undefined) { params.push(responsavel); sets.push(`responsavel=$${params.length}`); }
    if (prazo !== undefined) { params.push(prazo); sets.push(`prazo=$${params.length}`); }
    if (status === 'Resolvida' && evidencia !== undefined) { params.push(evidencia); sets.push(`evidencia_resolucao=$${params.length}`); }
    params.push(id);
    await this.pool.query(`UPDATE ocorrencias SET ${sets.join(', ')} WHERE id=$${params.length}`, params);
    return true;
  }
  // Mensagens de acompanhamento, em uma conversa única por ocorrência. `de` é 'prefeitura' ou
  // 'cidadao'. Marca a ocorrência como não lida para o outro lado da conversa.
  async addMensagem(id: string, de: 'prefeitura' | 'cidadao', texto: string): Promise<Mensagem | null> {
    const agora = new Date().toISOString();
    const msg: Mensagem = { id:'msg'+Date.now()+Math.random().toString(36).slice(2,7), de, texto, data:agora };
    const r = await this.pool.query('SELECT mensagens FROM ocorrencias WHERE id=$1', [id]);
    if (!r.rows[0]) return null;
    const msgs = r.rows[0].mensagens || [];
    msgs.push(msg);
    const flagCol = de === 'prefeitura' ? 'cidadao_nao_lido' : 'admin_nao_lido';
    await this.pool.query(`UPDATE ocorrencias SET mensagens=$1, ${flagCol}=true WHERE id=$2`, [JSON.stringify(msgs), id]);
    return msg;
  }
  // `lado` é 'admin' ou 'cidadao': zera a flag de não-lido correspondente ao abrir o detalhe.
  async marcarLida(id: string, lado: 'admin' | 'cidadao') {
    const col = lado === 'admin' ? 'admin_nao_lido' : 'cidadao_nao_lido';
    await this.pool.query(`UPDATE ocorrencias SET ${col}=false WHERE id=$1`, [id]);
  }
  async contarNaoLidasAdmin() {
    const r = await this.pool.query('SELECT COUNT(*) FROM ocorrencias WHERE admin_nao_lido=true');
    return parseInt(r.rows[0].count);
  }
  // Pedido de reabertura feito pelo cidadão após a ocorrência ser marcada como resolvida.
  // Não muda o status sozinho — fica registrado para o operador decidir e agir via updateStatus.
  async pedirReabertura(id: string, motivo: string): Promise<PedidoReabertura | null> {
    const agora = new Date().toISOString();
    const pedido = { motivo, data: agora, atendido: false };
    const r = await this.pool.query('SELECT pedidos_reabertura FROM ocorrencias WHERE id=$1', [id]);
    if (!r.rows[0]) return null;
    const pedidos = r.rows[0].pedidos_reabertura || [];
    pedidos.push(pedido);
    await this.pool.query('UPDATE ocorrencias SET pedidos_reabertura=$1, admin_nao_lido=true WHERE id=$2', [JSON.stringify(pedidos), id]);
    return pedido;
  }
  async getStats(): Promise<Stats> {
    const pool = this.pool;
    const total = await pool.query('SELECT COUNT(*) FROM ocorrencias');
    const byStatus = await pool.query(`SELECT status, COUNT(*) as n FROM ocorrencias GROUP BY status`);
    const byCat = await pool.query(`SELECT categoria, COUNT(*) as n FROM ocorrencias GROUP BY categoria ORDER BY n DESC`);
    const byBairro = await pool.query(`SELECT bairro, COUNT(*) as n FROM ocorrencias GROUP BY bairro ORDER BY n DESC LIMIT 5`);
    const sm: Record<string, number> = {}; byStatus.rows.forEach((r: Row) => sm[r.status] = parseInt(r.n));
    const naoLidas = await pool.query('SELECT COUNT(*) FROM ocorrencias WHERE admin_nao_lido=true');
    const atrasadas = await pool.query(`SELECT COUNT(*) FROM ocorrencias WHERE prazo IS NOT NULL AND prazo < NOW() AND status <> 'Resolvida'`);
    return {
      total: parseInt(total.rows[0].count),
      recebida: sm['Recebida']||0, analise: sm['Em análise']||0,
      encaminhada: sm['Encaminhada']||0, atendimento: sm['Em atendimento']||0, resolvida: sm['Resolvida']||0,
      categorias: byCat.rows.map((r: Row) => [r.categoria, parseInt(r.n)] as [string, number]),
      bairros: byBairro.rows.map((r: Row) => [r.bairro, parseInt(r.n)] as [string, number]),
      naoLidas: parseInt(naoLidas.rows[0].count),
      atrasadas: parseInt(atrasadas.rows[0].count)
    };
  }
  async listChatMensagens(limit = 60): Promise<ChatMsg[]> {
    const r = await this.pool.query('SELECT * FROM chat_mensagens ORDER BY criado_em DESC LIMIT $1', [limit]);
    return r.rows.reverse().map((m: Row) => ({ id:m.id, userId:m.user_id, nome:m.nome, texto:m.texto, criadoEm:m.criado_em }));
  }
  async addChatMensagem(msg: ChatMsg) {
    await this.pool.query('INSERT INTO chat_mensagens (id,user_id,nome,texto) VALUES ($1,$2,$3,$4)', [msg.id, msg.userId, msg.nome, msg.texto]);
  }
  async salvarArquivo(id: string, mime: string, dados: string) {
    await this.pool.query('INSERT INTO arquivos (id,mime,dados) VALUES ($1,$2,$3)', [id, mime, dados]);
  }
  async buscarArquivo(id: string) {
    const r = await this.pool.query('SELECT mime, dados FROM arquivos WHERE id=$1', [id]);
    return (r.rows[0] as { mime: string; dados: string } | undefined) || null;
  }
}
