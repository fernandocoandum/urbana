export type Role = 'morador' | 'admin' | string;
type Ts = string | Date;

export interface User {
  id: string;
  nome: string;
  email: string;
  senha: string;
  role: Role;
  bairro: string;
  termosAceitosEm?: Ts | null;
  foto: string | null;
  criadoEm?: Ts;
  resetToken?: string | null;
  resetExpiraEm?: string | null;
}

export interface HistoricoEntry {
  status: string;
  data: string;
  obs: string;
  setor?: string | null;
  tipo?: string;
}
export interface Mensagem { id: string; de: 'prefeitura' | 'cidadao'; texto: string; data: string }
export interface Avaliacao { nota: number; comentario: string; data: string }
export interface PedidoReabertura { motivo: string; data: string; atendido: boolean }

export interface Ocorrencia {
  id: string;
  protocolo: string;
  userId: string;
  titulo: string;
  descricao: string;
  categoria: string;
  endereco: string;
  bairro: string;
  referencia: string;
  foto: string | null;
  status: string;
  criadoEm: Ts;
  atualizadoEm: Ts;
  historico: HistoricoEntry[];
  mensagens: Mensagem[];
  nomeUsuario?: string;
  lat: number | null;
  lng: number | null;
  apoios: string[];
  avaliacao: Avaliacao | null;
  precisaoLocal: string;
  responsavel: string | null;
  setor: string | null;
  prazo: Ts | null;
  evidenciaResolucao: string | null;
  pedidosReabertura: PedidoReabertura[];
  naoLidoAdmin: boolean;
  naoLidoCidadao: boolean;
}
export type OcorrenciaDerivada = Ocorrencia & { atrasada: boolean; diasAberto: number; criticidade: number };

export interface ChatMsg { id: string; userId: string; nome: string; texto: string; criadoEm: Ts }

export interface ListFilters {
  userId?: string | null;
  status?: string | null;
  categoria?: string | null;
  bairro?: string | null;
  busca?: string | null;
}

export interface StatusOpts {
  obs?: string;
  setor?: string;
  responsavel?: string;
  prazo?: string | null;
  evidencia?: string;
  tipoEvento?: string;
}

export interface Stats {
  total: number;
  recebida: number;
  analise: number;
  encaminhada: number;
  atendimento: number;
  resolvida: number;
  categorias: [string, number][];
  bairros: [string, number][];
  naoLidas: number;
  atrasadas: number;
}

export interface Db {
  findUser(email: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  setResetToken(email: string, tokenHash: string, expiraEm: string): Promise<void>;
  findUserByResetTokenHash(tokenHash: string): Promise<{ id: string; nome: string; email: string } | null>;
  clearResetToken(userId: string): Promise<void>;
  deleteAllSessionsForUser(userId: string): Promise<void>;
  updatePerfil(userId: string, campos: { nome?: string; foto?: string | null; bairro?: string }): Promise<void>;
  contarApoiosDados(userId: string): Promise<number>;
  createUser(user: User): Promise<void>;
  aceitarTermos(userId: string): Promise<void>;
  emailExists(email: string): Promise<boolean>;
  createSession(token: string, userId: string, expiresAt?: number | null): Promise<void>;
  getSession(token: string): Promise<{ userId: string } | null>;
  deleteSession(token: string): Promise<void>;
  updateSenha(userId: string, novoHash: string): Promise<void>;
  listOcorrencias(filters?: ListFilters): Promise<OcorrenciaDerivada[]>;
  getOcorrencia(id: string): Promise<OcorrenciaDerivada | null>;
  createOcorrencia(oc: Ocorrencia): Promise<void>;
  toggleApoio(id: string, userId: string): Promise<{ apoiado: boolean; total: number } | null>;
  avaliar(id: string, nota: number, comentario: string | undefined): Promise<Avaliacao | null>;
  updateStatus(id: string, status: string, opts?: StatusOpts): Promise<boolean>;
  addMensagem(id: string, de: 'prefeitura' | 'cidadao', texto: string): Promise<Mensagem | null>;
  marcarLida(id: string, lado: 'admin' | 'cidadao'): Promise<void>;
  contarNaoLidasAdmin(): Promise<number>;
  pedirReabertura(id: string, motivo: string): Promise<PedidoReabertura | null>;
  getStats(): Promise<Stats>;
  listChatMensagens(limit?: number): Promise<ChatMsg[]>;
  addChatMensagem(msg: ChatMsg): Promise<void>;
  salvarArquivo(id: string, mime: string, dados: string): Promise<void>;
  buscarArquivo(id: string): Promise<{ mime: string; dados: string } | null>;
  gerarProtocolo(): Promise<string>;
}

/** Banco indisponível (Postgres configurado, mas fora do ar): a API responde 503. */
export class DbUnavailable extends Error {
  constructor(message = 'Banco de dados indisponível') {
    super(message);
    this.name = 'DbUnavailable';
  }
}
