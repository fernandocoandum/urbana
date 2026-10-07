import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { computeDerivedFields } from '@/features/ocorrencias/derived';
import { env, isProdIntent } from '@/lib/env';
import { hashPassword } from '@/lib/crypto';
import { anoAtualBR } from './util';
import type {
  Avaliacao, ChatMsg, Db, ListFilters, Mensagem, Ocorrencia, PedidoReabertura, Stats, StatusOpts, User,
} from './types';

interface JsonData {
  users: User[];
  ocorrencias: Ocorrencia[];
  sessions: Record<string, { userId: string; expiresAt: number | null }>;
  nextProtocolo: number;
  chatMensagens: ChatMsg[];
  arquivos: { id: string; mime: string; dados: string; criadoEm: string }[];
}

// URBANA_DB_FILE isola o banco de teste/E2E; na Vercel o disco só é gravável em /tmp.
export function jsonDbFile(): string {
  if (env.URBANA_DB_FILE) return path.resolve(env.URBANA_DB_FILE);
  if (env.VERCEL) return path.join(os.tmpdir(), 'urbana-db.json');
  return path.join(process.cwd(), 'db.json');
}

function seedData(): JsonData {
  return {
    users: [],
    ocorrencias: [
      { id:'oc1', protocolo:'PROT-2026-0001', userId:'u1', titulo:'Buraco na Rua João Machado', descricao:'Buraco de aproximadamente 80cm de diâmetro na pista principal.', categoria:'Pavimentação', endereco:'Rua João Machado, 450', bairro:'Centro', referencia:'Em frente à padaria Pão de Mel', foto:null, status:'Em atendimento', criadoEm:'2026-01-02T14:32:00.000Z', atualizadoEm:'2026-01-05T08:00:00.000Z', historico:[{status:'Recebida',data:'2026-01-02T14:32:00.000Z',obs:'Registrada pelo cidadão'},{status:'Em análise',data:'2026-01-03T09:15:00.000Z',obs:'Avaliação técnica iniciada'},{status:'Encaminhada',data:'2026-01-03T16:48:00.000Z',obs:'Encaminhada para Secretaria de Obras'},{status:'Em atendimento',data:'2026-01-05T08:00:00.000Z',obs:'Equipe de campo em ação'}], mensagens:[], lat:-28.2761, lng:-49.1712, apoios:[], avaliacao:null } as unknown as Ocorrencia,
      { id:'oc2', protocolo:'PROT-2026-0002', userId:'u1', titulo:'Poste sem iluminação — Av. Principal', descricao:'Poste apagado há mais de uma semana.', categoria:'Iluminação pública', endereco:'Av. Principal, 1200', bairro:'Centro', referencia:'Próximo ao Banco do Brasil', foto:null, status:'Em análise', criadoEm:'2026-01-05T10:00:00.000Z', atualizadoEm:'2026-01-06T09:00:00.000Z', historico:[{status:'Recebida',data:'2026-01-05T10:00:00.000Z',obs:'Registrada'},{status:'Em análise',data:'2026-01-06T09:00:00.000Z',obs:'Verificação agendada'}], mensagens:[], lat:-28.2745, lng:-49.1698, apoios:[], avaliacao:null } as unknown as Ocorrencia,
      { id:'oc3', protocolo:'PROT-2026-0003', userId:'u1', titulo:'Descarte irregular — Santa Clara', descricao:'Lixo e entulho descartados irregularmente.', categoria:'Limpeza urbana', endereco:'Estrada Santa Clara, s/n', bairro:'Santa Clara', referencia:'Ao lado da Escola Municipal', foto:null, status:'Resolvida', criadoEm:'2025-12-15T09:00:00.000Z', atualizadoEm:'2025-12-20T16:00:00.000Z', historico:[{status:'Recebida',data:'2025-12-15T09:00:00.000Z',obs:'Registrada'},{status:'Resolvida',data:'2025-12-20T16:00:00.000Z',obs:'Área limpa'}], mensagens:[], lat:-28.2815, lng:-49.1655, apoios:[], avaliacao:{nota:5,comentario:'Ficou ótimo, rápido demais!',data:'2025-12-21T10:00:00.000Z'} } as unknown as Ocorrencia
    ],
    sessions: {},
    nextProtocolo: 4,
    chatMensagens: [],
    arquivos: []
  };
}

export class JsonDb implements Db {
  private jsonDB!: JsonData;
  private file = jsonDbFile();

  static async init(): Promise<JsonDb> {
    console.log('Usando banco JSON local (db.json) — modo de desenvolvimento, não recomendado em produção.');
    const db = new JsonDb();
    db.initJsonDB();
    await db.ensureAdminAccount();
    return db;
  }

  private initJsonDB() {
    if (fs.existsSync(this.file)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        if (!data.chatMensagens) data.chatMensagens = [];
        if (!data.arquivos) data.arquivos = [];
        if (!data.users) data.users = [];
        if (!data.sessions) data.sessions = {};
        if (typeof data.nextProtocolo !== 'number') data.nextProtocolo = (data.ocorrencias?.length || 0) + 1;
        this.jsonDB = data;
        return;
      } catch {}
    }
    this.jsonDB = seedData();
    this.saveJsonDB();
  }

  private saveJsonDB() {
    // Propositalmente sem try/catch: uma falha de gravação (disco cheio, permissão, etc.) deve
    // estourar e ser tratada como erro pelo handler da rota (500), nunca ser engolida em
    // silêncio fingindo que o dado foi persistido.
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.jsonDB, null, 2));
  }

  private async ensureAdminAccount() {
    const jsonDB = this.jsonDB;
    const email = (env.ADMIN_EMAIL || 'admin@prefeitura.gov.br').trim().toLowerCase();
    const nome = env.ADMIN_NOME || 'Admin Prefeitura';
    const senhaEnv = env.ADMIN_SENHA;
    const existente = jsonDB.users.find(u => u.email === email);

    if (senhaEnv) {
      const hash = hashPassword(senhaEnv);
      if (existente) {
        existente.senha = hash; this.saveJsonDB();
        console.log(`Senha da conta administrativa (${email}) sincronizada com ADMIN_SENHA.`);
      } else {
        const novo: User = { id:'u1', nome, email, senha:hash, role:'admin', bairro:'', foto:null };
        novo.criadoEm = new Date().toISOString(); novo.termosAceitosEm = novo.criadoEm; jsonDB.users.push(novo); this.saveJsonDB();
        console.log(`Conta administrativa criada: ${email} (senha definida por ADMIN_SENHA).`);
      }
      return;
    }

    if (existente) return; // conta já existe e nenhuma senha nova foi solicitada — não mexe nela

    const senhaGerada = isProdIntent() ? crypto.randomBytes(9).toString('base64url') : 'admin';
    const hash = hashPassword(senhaGerada);
    const novo: User = { id:'u1', nome, email, senha:hash, role:'admin', bairro:'', foto:null };
    novo.criadoEm = new Date().toISOString(); novo.termosAceitosEm = novo.criadoEm; jsonDB.users.push(novo); this.saveJsonDB();
    console.log(`Modo de desenvolvimento: conta administrativa ${email} / senha "admin" (apenas local).`);
  }

  async gerarProtocolo() {
    const ano = anoAtualBR();
    const n = String(this.jsonDB.nextProtocolo).padStart(4,'0');
    this.jsonDB.nextProtocolo++;
    this.saveJsonDB();
    return `PROT-${ano}-${n}`;
  }

  async findUser(email: string) {
    return this.jsonDB.users.find(u => u.email === email) || null;
  }
  async findUserById(id: string) {
    return this.jsonDB.users.find(u => u.id === id) || null;
  }
  async setResetToken(email: string, tokenHash: string, expiraEm: string) {
    const u = this.jsonDB.users.find(u => u.email === email);
    if (u) { u.resetToken = tokenHash; u.resetExpiraEm = expiraEm; this.saveJsonDB(); }
  }
  async findUserByResetTokenHash(tokenHash: string) {
    const agora = Date.now();
    const u = this.jsonDB.users.find(u => u.resetToken === tokenHash);
    if (!u || !u.resetExpiraEm || new Date(u.resetExpiraEm).getTime() < agora) return null;
    return { id:u.id, nome:u.nome, email:u.email };
  }
  async clearResetToken(userId: string) {
    const u = this.jsonDB.users.find(u => u.id === userId);
    if (u) { u.resetToken = null; u.resetExpiraEm = null; this.saveJsonDB(); }
  }
  async deleteAllSessionsForUser(userId: string) {
    for (const t of Object.keys(this.jsonDB.sessions)) {
      if (this.jsonDB.sessions[t]?.userId === userId) delete this.jsonDB.sessions[t];
    }
    this.saveJsonDB();
  }
  async updatePerfil(userId: string, { nome, foto, bairro }: { nome?: string; foto?: string | null; bairro?: string }) {
    const u = this.jsonDB.users.find(u => u.id === userId);
    if (!u) return;
    if (nome !== undefined) u.nome = nome;
    if (foto !== undefined) u.foto = foto;
    if (bairro !== undefined) u.bairro = bairro;
    this.saveJsonDB();
  }
  async contarApoiosDados(userId: string) {
    return this.jsonDB.ocorrencias.filter(o => (o.apoios||[]).includes(userId)).length;
  }
  async createUser(user: User) {
    this.jsonDB.users.push(user); this.saveJsonDB();
  }
  async aceitarTermos(userId: string) {
    const agora = new Date().toISOString();
    const u = this.jsonDB.users.find(u => u.id === userId);
    if (u) { u.termosAceitosEm = agora; this.saveJsonDB(); }
  }
  async emailExists(email: string) {
    return this.jsonDB.users.some(u => u.email === email);
  }
  async createSession(token: string, userId: string, expiresAt?: number | null) {
    this.jsonDB.sessions[token] = { userId, expiresAt: expiresAt || null }; this.saveJsonDB();
  }
  async getSession(token: string) {
    const s = this.jsonDB.sessions[token];
    if (!s) return null;
    if (s.expiresAt && s.expiresAt < Date.now()) {
      delete this.jsonDB.sessions[token]; this.saveJsonDB();
      return null;
    }
    return s;
  }
  async deleteSession(token: string) {
    delete this.jsonDB.sessions[token]; this.saveJsonDB();
  }
  async updateSenha(userId: string, novoHash: string) {
    const u = this.jsonDB.users.find(u => u.id === userId);
    if (u) { u.senha = novoHash; this.saveJsonDB(); }
  }
  async listOcorrencias(filters: ListFilters = {}) {
    const jsonDB = this.jsonDB;
    let lista = jsonDB.ocorrencias.map(o => {
      const u = jsonDB.users.find(u => u.id === o.userId);
      return { ...o, nomeUsuario: u?.nome || '–' };
    });
    if (filters.userId) lista = lista.filter(o => o.userId === filters.userId);
    if (filters.status && filters.status !== 'todos') lista = lista.filter(o => o.status === filters.status);
    if (filters.categoria && filters.categoria !== 'todas') lista = lista.filter(o => o.categoria === filters.categoria);
    if (filters.bairro && filters.bairro !== 'todos') lista = lista.filter(o => o.bairro === filters.bairro);
    if (filters.busca) { const b = filters.busca.toLowerCase(); lista = lista.filter(o => o.protocolo.toLowerCase().includes(b)||o.titulo.toLowerCase().includes(b)||o.bairro.toLowerCase().includes(b)); }
    return lista.sort((a,b) => new Date(b.criadoEm).getTime()-new Date(a.criadoEm).getTime()).map(o => computeDerivedFields(o));
  }
  async getOcorrencia(id: string) {
    const o = this.jsonDB.ocorrencias.find(o => o.id === id);
    if (!o) return null;
    const u = this.jsonDB.users.find(u => u.id === o.userId);
    return computeDerivedFields({ ...o, nomeUsuario: u?.nome || '–' });
  }
  async createOcorrencia(oc: Ocorrencia) {
    this.jsonDB.ocorrencias.push(oc); this.saveJsonDB();
  }
  async toggleApoio(id: string, userId: string) {
    const oc = this.jsonDB.ocorrencias.find(o => o.id === id);
    if (!oc) return null;
    if (!oc.apoios) oc.apoios = [];
    const already = oc.apoios.includes(userId);
    oc.apoios = already ? oc.apoios.filter(u => u !== userId) : [...oc.apoios, userId];
    this.saveJsonDB();
    return { apoiado: !already, total: oc.apoios.length };
  }
  async avaliar(id: string, nota: number, comentario: string | undefined): Promise<Avaliacao | null> {
    const agora = new Date().toISOString();
    const avaliacao = { nota, comentario: comentario || '', data: agora };
    const oc = this.jsonDB.ocorrencias.find(o => o.id === id);
    if (!oc) return null;
    oc.avaliacao = avaliacao;
    this.saveJsonDB();
    return avaliacao;
  }
  async updateStatus(id: string, status: string, opts: StatusOpts = {}) {
    const { obs, setor, responsavel, prazo, evidencia, tipoEvento } = opts;
    const agora = new Date().toISOString();
    const histEntry: Ocorrencia['historico'][number] = { status, data: agora, obs: obs || `Status alterado para ${status}`, setor: setor || null };
    if (tipoEvento) histEntry.tipo = tipoEvento; // ex.: 'reabertura', para diferenciar na linha do tempo
    const idx = this.jsonDB.ocorrencias.findIndex(o => o.id === id);
    if (idx === -1) return false;
    const oc = this.jsonDB.ocorrencias[idx]!;
    oc.status = status;
    oc.atualizadoEm = agora;
    oc.historico.push(histEntry);
    if (setor !== undefined) oc.setor = setor;
    if (responsavel !== undefined) oc.responsavel = responsavel;
    if (prazo !== undefined) oc.prazo = prazo;
    if (status === 'Resolvida' && evidencia !== undefined) oc.evidenciaResolucao = evidencia;
    this.saveJsonDB();
    return true;
  }
  async addMensagem(id: string, de: 'prefeitura' | 'cidadao', texto: string): Promise<Mensagem | null> {
    const agora = new Date().toISOString();
    const msg: Mensagem = { id:'msg'+Date.now()+Math.random().toString(36).slice(2,7), de, texto, data:agora };
    const oc = this.jsonDB.ocorrencias.find(o => o.id === id);
    if (!oc) return null;
    if (!oc.mensagens) oc.mensagens = [];
    oc.mensagens.push(msg);
    if (de === 'prefeitura') oc.naoLidoCidadao = true; else oc.naoLidoAdmin = true;
    this.saveJsonDB();
    return msg;
  }
  async marcarLida(id: string, lado: 'admin' | 'cidadao') {
    const oc = this.jsonDB.ocorrencias.find(o => o.id === id);
    if (!oc) return;
    if (lado === 'admin') oc.naoLidoAdmin = false; else oc.naoLidoCidadao = false;
    this.saveJsonDB();
  }
  async contarNaoLidasAdmin() {
    return this.jsonDB.ocorrencias.filter(o => o.naoLidoAdmin).length;
  }
  async pedirReabertura(id: string, motivo: string): Promise<PedidoReabertura | null> {
    const agora = new Date().toISOString();
    const pedido = { motivo, data: agora, atendido: false };
    const oc = this.jsonDB.ocorrencias.find(o => o.id === id);
    if (!oc) return null;
    if (!oc.pedidosReabertura) oc.pedidosReabertura = [];
    oc.pedidosReabertura.push(pedido);
    oc.naoLidoAdmin = true;
    this.saveJsonDB();
    return pedido;
  }
  async getStats(): Promise<Stats> {
    const ocs = this.jsonDB.ocorrencias;
    const catMap: Record<string, number> = {}, bairroMap: Record<string, number> = {};
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
  }
  async listChatMensagens(limit = 60) {
    return this.jsonDB.chatMensagens.slice(-limit);
  }
  async addChatMensagem(msg: ChatMsg) {
    this.jsonDB.chatMensagens.push(msg);
    if (this.jsonDB.chatMensagens.length > 300) this.jsonDB.chatMensagens = this.jsonDB.chatMensagens.slice(-300);
    this.saveJsonDB();
  }
  async salvarArquivo(id: string, mime: string, dados: string) {
    // Nunca poda arquivos automaticamente aqui: um arquivo antigo pode ainda estar referenciado
    // como foto de uma ocorrência ou de um perfil, e apagá-lo silenciosamente quebraria essa
    // referência sem qualquer aviso.
    this.jsonDB.arquivos.push({ id, mime, dados, criadoEm:new Date().toISOString() });
    this.saveJsonDB();
  }
  async buscarArquivo(id: string) {
    const a = this.jsonDB.arquivos.find(a => a.id === id);
    return a ? { mime:a.mime, dados:a.dados } : null;
  }
}
