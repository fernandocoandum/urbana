import { BAIRROS_VALIDOS, CATEGORIAS_VALIDAS, STATUS_ORDEM, STATUS_VALIDOS } from '@/lib/constants';
import { getDb } from '@/lib/db';
import type { Ocorrencia, User } from '@/lib/db/types';
import type { Body, ServiceResult } from '@/lib/http';
import { rateLimit } from '@/lib/rate-limit';
import { cap, isCoordenadaValida, isOwnUploadUrl } from '@/lib/validation';

const j = (status: number, body: unknown): ServiceResult => ({ status, body });

export async function listar(user: User, sp: URLSearchParams): Promise<ServiceResult> {
  const db = await getDb();
  const filters = user.role === 'morador'
    ? { userId: user.id }
    : { status: sp.get('status'), categoria: sp.get('categoria'), bairro: sp.get('bairro'), busca: sp.get('busca') };
  return j(200, await db.listOcorrencias(filters));
}

export async function criar(user: User, body: Body): Promise<ServiceResult> {
  const db = await getDb();
  if (!user.termosAceitosEm) return j(403, { erro:'É preciso aceitar os termos de uso antes de registrar uma ocorrência.' });
  const rl = rateLimit('ocorrencia:' + user.id, 20, 60 * 60 * 1000);
  if (rl.limited) return j(429, { erro: 'Muitas denúncias em pouco tempo. Tente novamente mais tarde.' });
  const { titulo, descricao, categoria, endereco, bairro, referencia, foto, lat, lng, precisao } = body;
  if (typeof titulo !== 'string' || !titulo.trim() || !categoria || typeof endereco !== 'string' || !endereco.trim() || !bairro) return j(400, { erro:'Preencha os campos obrigatórios.' });
  if (!CATEGORIAS_VALIDAS.has(categoria)) return j(400, { erro:'Categoria inválida.' });
  if (!BAIRROS_VALIDOS.has(bairro)) return j(400, { erro:'Bairro inválido.' });
  if (!isOwnUploadUrl(foto)) return j(400, { erro:'Foto inválida.' });
  const temLat = lat !== undefined && lat !== null;
  const temLng = lng !== undefined && lng !== null;
  if (temLat !== temLng) return j(400, { erro:'Localização incompleta.' });
  if (temLat && !isCoordenadaValida(lat, lng)) return j(400, { erro:'Localização inválida.' });
  const precisaoLocal = temLat ? (precisao === 'gps' ? 'gps' : 'manual') : 'aproximado';
  const protocolo = await db.gerarProtocolo();
  const agora = new Date().toISOString();
  const oc: Ocorrencia = { id:'oc'+Date.now()+Math.random().toString(36).slice(2,7), protocolo, userId:user.id, titulo:cap(titulo,150), descricao:(cap(descricao,3000) as string)||'', categoria, endereco:cap(endereco,200), bairro, referencia:(cap(referencia,200) as string)||'', foto:foto||null, status:'Recebida', criadoEm:agora, atualizadoEm:agora, historico:[{status:'Recebida',data:agora,obs:'Ocorrência registrada pelo cidadão'}], mensagens:[], lat: temLat ? lat : null, lng: temLat ? lng : null, apoios:[], avaliacao:null, precisaoLocal, responsavel:null, setor:null, prazo:null, evidenciaResolucao:null, pedidosReabertura:[], naoLidoAdmin:false, naoLidoCidadao:false };
  await db.createOcorrencia(oc);
  return j(201, { ok:true, protocolo, id:oc.id });
}

export async function detalhe(user: User, id: string): Promise<ServiceResult> {
  const db = await getDb();
  const oc = await db.getOcorrencia(id);
  if (!oc) return j(404, { erro:'Não encontrada.' });
  if (user.role === 'morador' && oc.userId !== user.id) return j(403, { erro:'Sem permissão.' });
  return j(200, oc);
}

export async function alterarStatus(user: User | null, id: string, body: Body): Promise<ServiceResult> {
  const db = await getDb();
  if (!user || user.role !== 'admin') return j(403, { erro:'Acesso negado.' });
  const { status, obs, setor, responsavel, prazo, evidencia } = body;
  if (!STATUS_VALIDOS.has(status)) return j(400, { erro:'Status inválido.' });
  const atual = await db.getOcorrencia(id);
  if (!atual) return j(404, { erro:'Não encontrada.' });
  const idxAtual = (STATUS_ORDEM as readonly string[]).indexOf(atual.status);
  const idxNovo = (STATUS_ORDEM as readonly string[]).indexOf(status);
  const isRegressao = idxAtual !== -1 && idxNovo !== -1 && idxNovo < idxAtual;
  const obsLimpa = cap(obs, 500);
  if (isRegressao && (!obsLimpa || !obsLimpa.trim())) {
    return j(400, { erro:'Para retroceder o status é preciso informar uma justificativa.' });
  }
  if (status === 'Resolvida' && atual.pedidosReabertura && atual.pedidosReabertura.length) {
    const pendente = atual.pedidosReabertura[atual.pedidosReabertura.length - 1];
    if (pendente && !pendente.atendido && !obsLimpa) {
      return j(400, { erro:'Há um pedido de reabertura pendente — informe uma justificativa ao resolver novamente.' });
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
  const ok = await db.updateStatus(id, status, opts);
  if (!ok) return j(404, { erro:'Não encontrada.' });
  await db.marcarLida(id, 'admin');
  return j(200, { ok:true });
}

export async function enviarMensagem(user: User, id: string, body: Body): Promise<ServiceResult> {
  const db = await getDb();
  const oc = await db.getOcorrencia(id);
  if (!oc) return j(404, { erro:'Não encontrada.' });
  if (user.role !== 'admin' && oc.userId !== user.id) return j(403, { erro:'Sem permissão.' });
  const rl = rateLimit('mensagem:' + user.id, 60, 60 * 60 * 1000);
  if (rl.limited) return j(429, { erro: 'Muitas mensagens em pouco tempo. Tente novamente mais tarde.' });
  const { texto } = body;
  const textoLimpo = cap(texto, 1000);
  if (!textoLimpo || !textoLimpo.trim()) return j(400, { erro:'Mensagem vazia.' });
  const de = user.role === 'admin' ? 'prefeitura' : 'cidadao';
  const msg = await db.addMensagem(id, de, textoLimpo);
  if (!msg) return j(404, { erro:'Não encontrada.' });
  return j(201, { ok:true, mensagem: msg });
}

export async function marcarLida(user: User, id: string): Promise<ServiceResult> {
  const db = await getDb();
  const oc = await db.getOcorrencia(id);
  if (!oc) return j(404, { erro:'Não encontrada.' });
  if (user.role !== 'admin' && oc.userId !== user.id) return j(403, { erro:'Sem permissão.' });
  await db.marcarLida(id, user.role === 'admin' ? 'admin' : 'cidadao');
  return j(200, { ok:true });
}

export async function reabrir(user: User, id: string, body: Body): Promise<ServiceResult> {
  const db = await getDb();
  const oc = await db.getOcorrencia(id);
  if (!oc) return j(404, { erro:'Não encontrada.' });
  if (oc.userId !== user.id) return j(403, { erro:'Sem permissão.' });
  if (oc.status !== 'Resolvida') return j(400, { erro:'Só é possível pedir reabertura de ocorrências resolvidas.' });
  const { motivo } = body;
  const motivoLimpo = cap(motivo, 500);
  if (!motivoLimpo || !motivoLimpo.trim()) return j(400, { erro:'Descreva o motivo do pedido de reabertura.' });
  const pedido = await db.pedirReabertura(id, motivoLimpo);
  if (!pedido) return j(404, { erro:'Não encontrada.' });
  return j(201, { ok:true, pedido });
}

export async function apoiar(user: User, id: string): Promise<ServiceResult> {
  const db = await getDb();
  const oc = await db.getOcorrencia(id);
  if (!oc) return j(404, { erro:'Não encontrada.' });
  if (oc.userId === user.id) return j(400, { erro:'Você não pode apoiar sua própria ocorrência.' });
  const r = await db.toggleApoio(id, user.id);
  return j(200, r);
}

export async function avaliar(user: User, id: string, body: Body): Promise<ServiceResult> {
  const db = await getDb();
  const oc = await db.getOcorrencia(id);
  if (!oc) return j(404, { erro:'Não encontrada.' });
  if (oc.userId !== user.id) return j(403, { erro:'Sem permissão.' });
  if (oc.status !== 'Resolvida') return j(400, { erro:'Só é possível avaliar ocorrências resolvidas.' });
  if (oc.avaliacao) return j(400, { erro:'Ocorrência já avaliada.' });
  const { nota, comentario } = body;
  const n = parseInt(nota);
  if (!n || n < 1 || n > 5) return j(400, { erro:'Nota inválida.' });
  const avaliacao = await db.avaliar(id, n, cap(comentario,500));
  return j(200, { ok:true, avaliacao });
}

export async function mapa(user: User): Promise<ServiceResult> {
  const db = await getDb();
  const todas = await db.listOcorrencias({});
  const pontos = todas.map(o => ({
    id:o.id, protocolo:o.protocolo, titulo:o.titulo, categoria:o.categoria, status:o.status,
    bairro:o.bairro, lat:o.lat, lng:o.lng, apoios:(o.apoios||[]).length,
    apoiado: (o.apoios||[]).includes(user.id), isMine: o.userId === user.id,
    nomeUsuario: user.role === 'admin' ? o.nomeUsuario : null,
    precisaoLocal: o.precisaoLocal || 'manual'
  }));
  return j(200, pontos);
}

export async function stats(user: User | null): Promise<ServiceResult> {
  const db = await getDb();
  const s = await db.getStats();
  if (!user || user.role !== 'admin') {
    return j(200, { total:s.total, resolvida:s.resolvida, atendimento:s.atendimento, analise:s.analise });
  }
  return j(200, s);
}
