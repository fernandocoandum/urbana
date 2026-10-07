// Notificações ao cidadão (Etapa B): integração in-process com os Route Handlers e banco JSON
// próprio (não compartilha o arquivo com api.test.ts, que roda em paralelo noutro worker).
process.env.URBANA_DB_FILE = '.tmp/test-db-notificacoes.json';

import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { call } from './helpers/route';

beforeAll(() => {
  fs.rmSync(path.resolve('.tmp/test-db-notificacoes.json'), { force: true });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

let seq = 0;
const ipNovo = () => `10.77.${Math.floor(seq / 200)}.${(seq++ % 200) + 1}`;
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

async function cidadao(nome: string) {
  const ip = ipNovo();
  const email = `${nome.toLowerCase().replace(/\W/g, '')}${Date.now()}${Math.random().toString(36).slice(2, 6)}@teste.com`;
  const cad = await call('POST', '/api/cadastro', { body: { nome, email, senha: 'senha123', bairro: 'Centro' }, headers: { 'x-forwarded-for': ip } });
  expect(cad.status).toBe(201);
  const login = await call('POST', '/api/login', { body: { email, senha: 'senha123' }, headers: { 'x-forwarded-for': ip } });
  const { token } = await login.json();
  await call('POST', '/api/aceitar-termos', { headers: bearer(token) });
  return { token, email };
}

async function admin() {
  const login = await call('POST', '/api/login', { body: { email: 'admin@prefeitura.gov.br', senha: 'admin' }, headers: { 'x-forwarded-for': ipNovo() } });
  const { token } = await login.json();
  return token as string;
}

async function novaOcorrencia(token: string, titulo = 'Buraco da notificação') {
  const res = await call('POST', '/api/ocorrencias', {
    body: { titulo, categoria: 'Pavimentação', endereco: 'Rua N, 1', bairro: 'Centro' },
    headers: bearer(token),
  });
  expect(res.status).toBe(201);
  const { id, protocolo } = await res.json();
  return { id: id as string, protocolo: protocolo as string };
}

const mudarStatus = (adminToken: string, id: string, body: Record<string, unknown>) =>
  call('PUT', `/api/ocorrencias/${id}/status`, { body, headers: bearer(adminToken) });
const listar = async (token: string) => (await call('GET', '/api/notificacoes', { headers: bearer(token) })).json();

describe('GET /api/notificacoes', () => {
  it('exige autenticação (401)', async () => {
    expect((await call('GET', '/api/notificacoes')).status).toBe(401);
    expect((await call('POST', '/api/notificacoes/lidas', { body: {} })).status).toBe(401);
  });

  it('cidadão novo não tem notificações', async () => {
    const { token } = await cidadao('Sem Novidades');
    expect(await listar(token)).toEqual({ itens: [], naoLidas: 0 });
  });
});

describe('notificações de status e mensagem', () => {
  it('admin muda o status: o cidadão vê 1 não lida com protocolo e observação', async () => {
    const { token } = await cidadao('Maria Status');
    const adm = await admin();
    const { id, protocolo } = await novaOcorrencia(token);
    const r = await mudarStatus(adm, id, { status: 'Em análise', obs: 'Equipe técnica vai ao local.' });
    expect(r.status).toBe(200);
    const { itens, naoLidas } = await listar(token);
    expect(naoLidas).toBe(1);
    expect(itens).toHaveLength(1);
    expect(itens[0]).toMatchObject({ tipo: 'status', ocorrenciaId: id, lida: false });
    expect(itens[0].titulo).toBe(`Sua ocorrência ${protocolo} está Em análise`);
    expect(itens[0].texto).toContain('Equipe técnica vai ao local.');
    expect(itens[0].userId).toBeTruthy();
  });

  it('salvar o mesmo status sem setor novo não notifica', async () => {
    const { token } = await cidadao('Joana Igual');
    const adm = await admin();
    const { id } = await novaOcorrencia(token);
    await mudarStatus(adm, id, { status: 'Em análise' });
    await mudarStatus(adm, id, { status: 'Em análise', obs: 'só uma nota interna' });
    expect((await listar(token)).itens).toHaveLength(1);
  });

  it('encaminhar para um setor sem mudar o status notifica o setor', async () => {
    const { token } = await cidadao('Setor Novo');
    const adm = await admin();
    const { id } = await novaOcorrencia(token);
    await mudarStatus(adm, id, { status: 'Encaminhada', setor: 'Secretaria de Obras' });
    await mudarStatus(adm, id, { status: 'Encaminhada', setor: 'Secretaria de Meio Ambiente' });
    const { itens } = await listar(token);
    expect(itens).toHaveLength(2);
    expect(itens[0].titulo).toContain('Secretaria de Meio Ambiente');
  });

  it('mensagem da prefeitura gera notificação; a do cidadão não', async () => {
    const { token } = await cidadao('Ana Mensagem');
    const adm = await admin();
    const { id } = await novaOcorrencia(token);
    const doCidadao = await call('POST', `/api/ocorrencias/${id}/mensagens`, { body: { texto: 'Alguma novidade?' }, headers: bearer(token) });
    expect(doCidadao.status).toBe(201);
    expect((await listar(token)).naoLidas).toBe(0);

    const longa = 'Olá! ' + 'x'.repeat(300);
    const daPrefeitura = await call('POST', `/api/ocorrencias/${id}/mensagens`, { body: { texto: longa }, headers: bearer(adm) });
    expect(daPrefeitura.status).toBe(201);
    const { itens, naoLidas } = await listar(token);
    expect(naoLidas).toBe(1);
    expect(itens[0]).toMatchObject({ tipo: 'mensagem', ocorrenciaId: id });
    expect(itens[0].texto.length).toBeLessThanOrEqual(140);
    expect(itens[0].texto.endsWith('…')).toBe(true);
  });

  it('outro cidadão não vê as notificações alheias', async () => {
    const dono = await cidadao('Dono Privado');
    const outro = await cidadao('Outro Curioso');
    const adm = await admin();
    const { id } = await novaOcorrencia(dono.token);
    await mudarStatus(adm, id, { status: 'Em análise' });
    expect((await listar(dono.token)).naoLidas).toBe(1);
    expect(await listar(outro.token)).toEqual({ itens: [], naoLidas: 0 });
  });
});

describe('POST /api/notificacoes/lidas', () => {
  async function comTres() {
    const c = await cidadao('Lidas Teste');
    const adm = await admin();
    const a = await novaOcorrencia(c.token, 'Primeira');
    const b = await novaOcorrencia(c.token, 'Segunda');
    await mudarStatus(adm, a.id, { status: 'Em análise' });
    await mudarStatus(adm, a.id, { status: 'Em atendimento' });
    await mudarStatus(adm, b.id, { status: 'Em análise' });
    return { ...c, adm, a, b };
  }

  it('sem ids marca todas', async () => {
    const { token } = await comTres();
    expect((await listar(token)).naoLidas).toBe(3);
    const r = await call('POST', '/api/notificacoes/lidas', { body: {}, headers: bearer(token) });
    expect(r.status).toBe(200);
    expect((await r.json()).naoLidas).toBe(0);
    const { itens } = await listar(token);
    expect(itens).toHaveLength(3);
    expect(itens.every((n: { lida: boolean }) => n.lida)).toBe(true);
  });

  it('com ids marca só as indicadas', async () => {
    const { token } = await comTres();
    const { itens } = await listar(token);
    const r = await call('POST', '/api/notificacoes/lidas', { body: { ids: [itens[0].id] }, headers: bearer(token) });
    expect((await r.json()).naoLidas).toBe(2);
  });

  it('com ocorrenciaId marca as daquela ocorrência', async () => {
    const { token, a } = await comTres();
    const r = await call('POST', '/api/notificacoes/lidas', { body: { ocorrenciaId: a.id }, headers: bearer(token) });
    expect((await r.json()).naoLidas).toBe(1);
  });

  it('ids de outro usuário são ignorados (no-op)', async () => {
    const dono = await comTres();
    const intruso = await cidadao('Intruso Lidas');
    const { itens } = await listar(dono.token);
    const r = await call('POST', '/api/notificacoes/lidas', { body: { ids: itens.map((n: { id: string }) => n.id) }, headers: bearer(intruso.token) });
    expect(r.status).toBe(200);
    expect((await listar(dono.token)).naoLidas).toBe(3);
  });

  it('ocorrenciaId de outro usuário também é no-op', async () => {
    const dono = await comTres();
    const intruso = await cidadao('Intruso Oc');
    await call('POST', '/api/notificacoes/lidas', { body: { ocorrenciaId: dono.a.id }, headers: bearer(intruso.token) });
    expect((await listar(dono.token)).naoLidas).toBe(3);
  });

  it('valida o formato do corpo (400) e limita ids a 100', async () => {
    const { token } = await cidadao('Corpo Ruim');
    expect((await call('POST', '/api/notificacoes/lidas', { body: { ids: 'abc' }, headers: bearer(token) })).status).toBe(400);
    expect((await call('POST', '/api/notificacoes/lidas', { body: { ids: [1, 2] }, headers: bearer(token) })).status).toBe(400);
    expect((await call('POST', '/api/notificacoes/lidas', { body: { ocorrenciaId: 5 }, headers: bearer(token) })).status).toBe(400);
    const muitos = Array.from({ length: 500 }, (_, i) => 'x' + i);
    expect((await call('POST', '/api/notificacoes/lidas', { body: { ids: muitos }, headers: bearer(token) })).status).toBe(200);
  });
});

describe('e-mail da notificação', () => {
  it('sem Gmail/Resend a mudança de status responde 200', async () => {
    vi.stubEnv('GMAIL_USER', '');
    vi.stubEnv('GMAIL_APP_PASSWORD', '');
    vi.stubEnv('RESEND_API_KEY', '');
    const { token } = await cidadao('Sem Canal');
    const adm = await admin();
    const { id } = await novaOcorrencia(token);
    expect((await mudarStatus(adm, id, { status: 'Em análise' })).status).toBe(200);
    expect((await listar(token)).naoLidas).toBe(1);
  });

  it('com Resend configurado envia o e-mail escapado; falha no envio não derruba o status', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_teste');
    vi.stubEnv('PUBLIC_ORIGIN', 'https://urbana.exemplo.gov.br/');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { token, email } = await cidadao('Com Canal');
    const adm = await admin();
    const { id } = await novaOcorrencia(token);
    const r = await mudarStatus(adm, id, { status: 'Em análise', obs: '<script>alert(1)</script> & cia' });
    expect(r.status).toBe(200);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    const corpo = JSON.parse(init.body as string);
    expect(corpo.to).toEqual([email]);
    expect(corpo.html).toContain('&lt;script&gt;');
    expect(corpo.html).not.toContain('<script>');
    expect(corpo.html).toContain(`https://urbana.exemplo.gov.br/ocorrencias/${id}`);

    // Falha do provedor: o status continua 200 e a notificação no app continua gravada.
    fetchMock.mockRejectedValue(new Error('rede caiu'));
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r2 = await mudarStatus(adm, id, { status: 'Em atendimento' });
    expect(r2.status).toBe(200);
    await vi.waitFor(() => expect(erro).toHaveBeenCalled());
    erro.mockRestore();
    expect((await listar(token)).naoLidas).toBe(2);
  });

  it('NOTIFICACOES_EMAIL=0 desliga o e-mail, mas a notificação no app continua', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_teste');
    vi.stubEnv('NOTIFICACOES_EMAIL', '0');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { token } = await cidadao('Sem Email');
    const adm = await admin();
    const { id } = await novaOcorrencia(token);
    expect((await mudarStatus(adm, id, { status: 'Em análise' })).status).toBe(200);
    expect((await listar(token)).naoLidas).toBe(1);
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('pedido de reabertura', () => {
  async function resolvidaComPedido() {
    const c = await cidadao('Reabre Pedido');
    const adm = await admin();
    const o = await novaOcorrencia(c.token);
    expect((await mudarStatus(adm, o.id, { status: 'Resolvida', obs: 'Feito', evidencia: 'foto' })).status).toBe(200);
    const pedido = await call('POST', `/api/ocorrencias/${o.id}/reabrir`, { body: { motivo: 'O buraco voltou' }, headers: bearer(c.token) });
    expect(pedido.status).toBe(201);
    return { ...c, adm, o };
  }
  const pedidos = async (token: string, id: string) => (await (await call('GET', `/api/ocorrencias/${id}`, { headers: bearer(token) })).json()).pedidosReabertura;

  it('vira atendido ao resolver de novo com justificativa, e o cidadão é avisado', async () => {
    const { token, adm, o } = await resolvidaComPedido();
    expect((await pedidos(token, o.id))[0].atendido).toBe(false);
    // Sem justificativa continua barrado.
    expect((await mudarStatus(adm, o.id, { status: 'Resolvida' })).status).toBe(400);
    expect((await pedidos(token, o.id))[0].atendido).toBe(false);
    const ok = await mudarStatus(adm, o.id, { status: 'Resolvida', obs: 'Revisamos: o reparo está correto.' });
    expect(ok.status).toBe(200);
    expect((await pedidos(token, o.id))[0].atendido).toBe(true);
    const { itens } = await listar(token);
    expect(itens[0]).toMatchObject({ tipo: 'reabertura' });
    expect(itens[0].titulo).toContain('analisado');
  });

  it('vira atendido ao reabrir (regressão) e o aviso diz que foi atendido', async () => {
    const { token, adm, o } = await resolvidaComPedido();
    const ok = await mudarStatus(adm, o.id, { status: 'Em atendimento', obs: 'Equipe volta ao local.' });
    expect(ok.status).toBe(200);
    expect((await pedidos(token, o.id))[0].atendido).toBe(true);
    const { itens } = await listar(token);
    expect(itens[0]).toMatchObject({ tipo: 'reabertura' });
    expect(itens[0].titulo).toContain('atendido');
  });
});
