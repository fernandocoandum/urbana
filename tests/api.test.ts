// Testes de integração in-process: chamam os Route Handlers diretamente (sem subir servidor), com
// o banco JSON local isolado em .tmp/test-db.json (URBANA_DB_FILE, definido no vitest.config.ts).
// Cobrem as validações de segurança do legado e o fluxo principal (cadastro → login → registrar
// ocorrência → consultar), mais os recursos novos da Etapa B (cookie de sessão, CSRF, 404 JSON).
//
// Rate limit: todas as chamadas "sem IP" caem no mesmo balde ('desconhecido'), então o total de
// cadastros neste bloco precisa ficar dentro de 8/hora e o de logins dentro de 10/15min. Os testes
// novos usam um x-forwarded-for próprio para não consumir esses baldes.
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { call } from './helpers/route';

const DB_FILE = path.resolve(process.env.URBANA_DB_FILE || '.tmp/test-db.json');

beforeAll(() => {
  // Sobe numa base limpa: evita que sobras de execuções anteriores colidam com e-mails/contagens.
  fs.rmSync(DB_FILE, { force: true });
});

function uniqueEmail(prefix: string) {
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 7)}@teste.com`;
}
const post = (pathname: string, body: unknown, headers: Record<string, string> = {}) =>
  call('POST', pathname, { body, headers });
const get = (pathname: string, headers: Record<string, string> = {}) => call('GET', pathname, { headers });

// E-mail/senha compartilhados entre os blocos de cadastro e login — mantém o total de chamadas a
// /api/cadastro dentro do limite de 8/hora por IP que o próprio rate limiting aplica.
const CONTA_PRINCIPAL: { nome: string; email: string; senha: string; bairro: string; token?: string } = {
  nome: 'Usuário Teste', email: uniqueEmail('principal'), senha: 'senha123', bairro: 'Centro',
};

describe('POST /api/cadastro — validações da Fase 1', () => {
  it('cria conta com dados válidos (201)', async () => {
    const res = await post('/api/cadastro', CONTA_PRINCIPAL);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('rejeita e-mail em formato inválido (400)', async () => {
    const res = await post('/api/cadastro', { nome: 'X', email: 'nao-e-email', senha: 'senha123', bairro: 'Centro' });
    expect(res.status).toBe(400);
  });

  it('rejeita bairro fora da lista fechada — validação adicionada na Fase 1 (400)', async () => {
    const res = await post('/api/cadastro', { nome: 'X', email: uniqueEmail('bairro'), senha: 'senha123', bairro: 'BairroFalsoXYZ' });
    expect(res.status).toBe(400);
  });

  it('rejeita senha curta demais, < 6 caracteres (400)', async () => {
    const res = await post('/api/cadastro', { nome: 'X', email: uniqueEmail('curta'), senha: '123', bairro: 'Centro' });
    expect(res.status).toBe(400);
  });

  it('rejeita corpo vazio/campos ausentes (400, não 500)', async () => {
    const res = await post('/api/cadastro', {});
    expect(res.status).toBe(400);
  });

  it('aceita payload de XSS no nome sem quebrar (a defesa é o escape do front na hora de exibir, não uma recusa aqui)', async () => {
    const res = await post('/api/cadastro', { nome: '<script>alert(1)</script>', email: uniqueEmail('xss'), senha: 'senha123', bairro: 'Centro' });
    expect(res.status).toBe(201);
  });

  it('não permite e-mail duplicado (400)', async () => {
    const res = await post('/api/cadastro', CONTA_PRINCIPAL);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.erro).toMatch(/já cadastrado/i);
  });
});

describe('POST /api/login — validações da Fase 1', () => {
  it('autentica com credenciais corretas e devolve um token (200)', async () => {
    const res = await post('/api/login', { email: CONTA_PRINCIPAL.email, senha: CONTA_PRINCIPAL.senha });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThan(20);
    CONTA_PRINCIPAL.token = body.token; // reaproveitado no bloco de ocorrências abaixo
  });

  it('rejeita senha errada (401) com a MESMA mensagem genérica usada para e-mail inexistente — não revela qual dos dois estava errado', async () => {
    const resSenhaErrada = await post('/api/login', { email: CONTA_PRINCIPAL.email, senha: 'senhaErrada999' });
    expect(resSenhaErrada.status).toBe(401);
    const resEmailInexistente = await post('/api/login', { email: uniqueEmail('inexistente'), senha: 'qualquercoisa' });
    expect(resEmailInexistente.status).toBe(401);
    const [a, b] = await Promise.all([resSenhaErrada.json(), resEmailInexistente.json()]);
    expect(a.erro).toBe(b.erro);
  });

  it('trata payload de SQL injection no e-mail como credencial inválida, sem erro 500 (query é sempre parametrizada)', async () => {
    const res = await post('/api/login', { email: "' OR '1'='1", senha: "' OR '1'='1" });
    expect(res.status).toBe(401);
  });

  it('corta senha absurdamente longa ANTES do scrypt (mitigação de DoS da Fase 1) — responde rápido, sem travar', async () => {
    const senhaGigante = 'x'.repeat(5000);
    const inicio = Date.now();
    const res = await post('/api/login', { email: CONTA_PRINCIPAL.email, senha: senhaGigante });
    const duracaoMs = Date.now() - inicio;
    expect(res.status).toBe(400);
    expect(duracaoMs).toBeLessThan(2000); // se rodasse scrypt na senha inteira, seria ordens de grandeza mais lento
  });

  it('rejeita corpo vazio/campos ausentes (400)', async () => {
    const res = await post('/api/login', {});
    expect(res.status).toBe(400);
  });
});

describe('Headers de segurança nas respostas de API (Fase 1)', () => {
  // Os headers das páginas HTML (CSP etc.) são conferidos no Playwright: tests/e2e/headers.spec.ts.
  it('toda resposta de API carrega os headers de segurança', async () => {
    const res = await get('/api/me');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(res.headers.get('strict-transport-security')).toBeTruthy();
  });
});

describe('Autorização em rotas protegidas', () => {
  it('rejeita acesso sem token (401)', async () => {
    const res = await get('/api/perfil');
    expect(res.status).toBe(401);
  });
  it('rejeita token inválido/forjado (401)', async () => {
    const res = await get('/api/perfil', { Authorization: 'Bearer token-forjado-que-nao-existe' });
    expect(res.status).toBe(401);
  });
});

describe('Fluxo principal: registrar e consultar uma ocorrência', () => {
  const outraConta = { nome: 'Outro Cidadão', email: uniqueEmail('outro'), senha: 'senha123', bairro: 'Centro' };
  let ocorrenciaId: string;
  const auth = () => ({ Authorization: `Bearer ${CONTA_PRINCIPAL.token}` });

  it('exige aceite dos termos de uso antes de registrar uma ocorrência (403)', async () => {
    const res = await post('/api/ocorrencias', {
      titulo: 'Buraco na rua', categoria: 'Pavimentação', endereco: 'Rua Teste, 1', bairro: 'Centro',
    }, auth());
    expect(res.status).toBe(403);
  });

  it('registra a ocorrência depois de aceitar os termos, com protocolo no formato PROT-AAAA-NNNN e status inicial "Recebida"', async () => {
    const aceite = await post('/api/aceitar-termos', {}, auth());
    expect(aceite.status).toBe(200);

    const res = await post('/api/ocorrencias', {
      titulo: 'Buraco grande na Rua das Flores', categoria: 'Pavimentação', endereco: 'Rua das Flores, 100', bairro: 'Centro',
    }, auth());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.protocolo).toMatch(/^PROT-\d{4}-\d{4}$/);
    ocorrenciaId = body.id;

    const det = await get(`/api/ocorrencias/${ocorrenciaId}`, auth());
    const oc = await det.json();
    expect(oc.status).toBe('Recebida');
    expect(oc.historico).toHaveLength(1);
  });

  it('rejeita categoria e bairro fora das listas fechadas (400)', async () => {
    const res = await post('/api/ocorrencias', {
      titulo: 'X', categoria: 'CategoriaFalsa', endereco: 'Rua X, 1', bairro: 'Centro',
    }, auth());
    expect(res.status).toBe(400);
  });

  it('rejeita coordenadas de localização inválidas (400)', async () => {
    const res = await post('/api/ocorrencias', {
      titulo: 'X', categoria: 'Pavimentação', endereco: 'Rua X, 1', bairro: 'Centro', lat: 999, lng: 999,
    }, auth());
    expect(res.status).toBe(400);
  });

  it('bloqueia um cidadão de ver a ocorrência de outro cidadão — escalonamento horizontal de privilégio (403)', async () => {
    await post('/api/cadastro', outraConta);
    const loginOutro = await post('/api/login', { email: outraConta.email, senha: outraConta.senha });
    const { token: tokenOutro } = await loginOutro.json();

    const res = await get(`/api/ocorrencias/${ocorrenciaId}`, { Authorization: `Bearer ${tokenOutro}` });
    expect(res.status).toBe(403);
  });

  it('bloqueia um cidadão comum de alterar o status de uma ocorrência — escalonamento vertical de privilégio (403)', async () => {
    const res = await call('PUT', `/api/ocorrencias/${ocorrenciaId}/status`, {
      body: { status: 'Resolvida' },
      headers: auth(),
    });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------------------------
// Novos na Etapa B
// ---------------------------------------------------------------------------------------------

function cookieDe(res: Response, nome = 'urbana_token'): { valor: string; bruto: string } | null {
  for (const c of res.headers.getSetCookie()) {
    if (c.startsWith(nome + '=')) return { valor: c.slice(nome.length + 1).split(';')[0]!, bruto: c };
  }
  return null;
}

describe('Sessão em cookie httpOnly (Etapa B)', () => {
  const ip = { 'x-forwarded-for': '10.20.30.40' };
  const conta = { nome: 'Cookie Teste', email: uniqueEmail('cookie'), senha: 'senha123', bairro: 'Centro' };
  let token = '';

  it('login devolve o token no corpo E grava o cookie urbana_token (HttpOnly, SameSite=Lax, Path=/, 30 dias)', async () => {
    expect((await post('/api/cadastro', conta, ip)).status).toBe(201);
    const res = await post('/api/login', { email: conta.email, senha: conta.senha }, ip);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.token).toBe('string');
    token = body.token;
    const c = cookieDe(res);
    expect(c).not.toBeNull();
    expect(c!.valor).toBe(token);
    expect(c!.bruto).toMatch(/HttpOnly/i);
    expect(c!.bruto).toMatch(/SameSite=lax/i);
    expect(c!.bruto).toMatch(/Path=\//i);
    expect(c!.bruto).toMatch(/Max-Age=2592000/i);
    expect(c!.bruto).not.toMatch(/Secure/i); // http no teste
  });

  it('cookie Secure quando o proto é https (x-forwarded-proto)', async () => {
    const res = await post('/api/login', { email: conta.email, senha: conta.senha }, { ...ip, 'x-forwarded-proto': 'https' });
    expect(cookieDe(res)!.bruto).toMatch(/Secure/i);
  });

  it('/api/me aceita só o cookie, sem Authorization', async () => {
    const res = await get('/api/me', { cookie: `urbana_token=${token}` });
    expect(res.status).toBe(200);
    const me = await res.json();
    expect(me.email).toBe(conta.email);
    expect(me.senha).toBeUndefined();
    expect(cookieDe(res)).toBeNull(); // já tem cookie: não regrava
  });

  it('/api/me com Bearer e sem cookie devolve set-cookie (migra quem estava só com o token no localStorage)', async () => {
    const res = await get('/api/me', { Authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
    expect(cookieDe(res)!.valor).toBe(token);
  });

  it('cookie inválido/forjado não autentica (401)', async () => {
    expect((await get('/api/me', { cookie: 'urbana_token=forjado' })).status).toBe(401);
  });

  it('CSRF: POST autenticado por cookie com Origin de outro host é bloqueado (403)', async () => {
    const res = await post('/api/aceitar-termos', {}, { cookie: `urbana_token=${token}`, origin: 'http://evil.example', host: 'localhost' });
    expect(res.status).toBe(403);
    expect((await res.json()).erro).toBe('Origem não permitida.');
  });

  it('CSRF: o mesmo POST com Origin do próprio host passa; sem Origin também; GET nunca é checado', async () => {
    const mesmo = await post('/api/aceitar-termos', {}, { cookie: `urbana_token=${token}`, origin: 'http://localhost', host: 'localhost' });
    expect(mesmo.status).toBe(200);
    const semOrigin = await post('/api/aceitar-termos', {}, { cookie: `urbana_token=${token}` });
    expect(semOrigin.status).toBe(200);
    const getOutra = await get('/api/me', { cookie: `urbana_token=${token}`, origin: 'http://evil.example' });
    expect(getOutra.status).toBe(200);
  });

  it('CSRF: respeita x-forwarded-host atrás de proxy', async () => {
    const ok = await post('/api/aceitar-termos', {}, { cookie: `urbana_token=${token}`, origin: 'https://urbana.exemplo.br', 'x-forwarded-host': 'urbana.exemplo.br', host: 'interno:3000' });
    expect(ok.status).toBe(200);
  });

  it('CSRF não se aplica a Bearer (o token não é enviado automaticamente pelo navegador)', async () => {
    const res = await post('/api/aceitar-termos', {}, { Authorization: `Bearer ${token}`, origin: 'http://evil.example' });
    expect(res.status).toBe(200);
  });

  it('CSRF de login: POST /api/login com Origin de outro host → 403, mesmo sem cookie; sem Origin ou com o próprio host passa', async () => {
    const hostil = await post('/api/login', { email: conta.email, senha: conta.senha }, { ...ip, origin: 'http://evil.example', host: 'localhost' });
    expect(hostil.status).toBe(403);
    expect((await hostil.json()).erro).toBe('Origem não permitida.');
    for (const rota of ['/api/cadastro', '/api/recuperar-senha', '/api/redefinir-senha', '/api/login/google']) {
      expect((await post(rota, {}, { ...ip, origin: 'http://evil.example', host: 'localhost' })).status).toBe(403);
    }
    const proprio = await post('/api/login', { email: conta.email, senha: conta.senha }, { ...ip, origin: 'http://localhost', host: 'localhost' });
    expect(proprio.status).toBe(200);
  });

  it('/api/me com Bearer diferente do cookie atual regrava o cookie', async () => {
    const outro = await (await post('/api/login', { email: conta.email, senha: conta.senha }, ip)).json();
    const res = await get('/api/me', { Authorization: `Bearer ${outro.token}`, cookie: `urbana_token=${token}` });
    expect(res.status).toBe(200);
    expect(cookieDe(res)!.valor).toBe(outro.token);
  });

  it('logout apaga a sessão (cookie) e limpa o cookie', async () => {
    const res = await post('/api/logout', {}, { cookie: `urbana_token=${token}` });
    expect(res.status).toBe(200);
    const c = cookieDe(res);
    expect(c!.valor).toBe('');
    expect(c!.bruto).toMatch(/Max-Age=0/i);
    expect((await get('/api/me', { cookie: `urbana_token=${token}` })).status).toBe(401);
    expect((await get('/api/me', { Authorization: `Bearer ${token}` })).status).toBe(401);
  });

  it('logout via Bearer também apaga a sessão', async () => {
    const login = await post('/api/login', { email: conta.email, senha: conta.senha }, ip);
    const { token: t2 } = await login.json();
    expect((await post('/api/logout', {}, { Authorization: `Bearer ${t2}` })).status).toBe(200);
    expect((await get('/api/me', { Authorization: `Bearer ${t2}` })).status).toBe(401);
  });
});

describe('Rotas e perfil (Etapa B)', () => {
  const ip = { 'x-forwarded-for': '10.20.30.41' };
  const conta = { nome: 'Perfil Teste', email: uniqueEmail('perfil'), senha: 'senha123', bairro: 'Centro' };
  let auth: Record<string, string>;

  it('rota inexistente → 404 JSON', async () => {
    const res = await get('/api/rota-que-nao-existe');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ erro: 'Rota não encontrada.' });
    const post404 = await post('/api/a/b/c', {});
    expect(post404.status).toBe(404);
  });

  it('PUT /api/perfil com bairro inválido → 400', async () => {
    await post('/api/cadastro', conta, ip);
    const { token } = await (await post('/api/login', { email: conta.email, senha: conta.senha }, ip)).json();
    auth = { Authorization: `Bearer ${token}` };
    const res = await call('PUT', '/api/perfil', { body: { bairro: 'BairroFalsoXYZ' }, headers: auth });
    expect(res.status).toBe(400);
    expect((await res.json()).erro).toBe('Bairro inválido.');
  });

  it('PUT /api/perfil aceita bairro válido e vazio, e o GET reflete', async () => {
    expect((await call('PUT', '/api/perfil', { body: { bairro: 'Pinheiral' }, headers: auth })).status).toBe(200);
    expect((await (await get('/api/perfil', auth)).json()).bairro).toBe('Pinheiral');
    expect((await call('PUT', '/api/perfil', { body: { bairro: '' }, headers: auth })).status).toBe(200);
    expect((await (await get('/api/perfil', auth)).json()).bairro).toBe('');
  });

  it('PUT /api/perfil: nome em branco (400) e foto fora do upload próprio (400) continuam valendo', async () => {
    expect((await call('PUT', '/api/perfil', { body: { nome: '  ' }, headers: auth })).status).toBe(400);
    expect((await call('PUT', '/api/perfil', { body: { foto: 'https://evil.com/x.png' }, headers: auth })).status).toBe(400);
    expect((await call('PUT', '/api/perfil', { body: { nome: 'Novo Nome' }, headers: auth })).status).toBe(200);
    expect((await (await get('/api/perfil', auth)).json()).nome).toBe('Novo Nome');
  });

  it('admin semeado (admin@prefeitura.gov.br / admin) lista as 3 ocorrências de exemplo', async () => {
    const login = await post('/api/login', { email: 'admin@prefeitura.gov.br', senha: 'admin' }, { 'x-forwarded-for': '10.20.30.42' });
    expect(login.status).toBe(200);
    const { token, role } = await login.json();
    expect(role).toBe('admin');
    const lista = await (await get('/api/ocorrencias', { Authorization: `Bearer ${token}` })).json();
    const protocolos = lista.map((o: { protocolo: string }) => o.protocolo);
    expect(protocolos).toEqual(expect.arrayContaining(['PROT-2026-0001', 'PROT-2026-0002', 'PROT-2026-0003']));
    // o admin vê todos os campos de /api/stats; o morador só os públicos
    const stats = await (await get('/api/stats', { Authorization: `Bearer ${token}` })).json();
    expect(stats).toHaveProperty('naoLidas');
    expect(await (await get('/api/stats', auth)).json()).not.toHaveProperty('naoLidas');
  });

  it('upload de imagem e leitura pública em /api/arquivos/:id', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0, 0, 0, 0, 0]);
    const up = await post('/api/upload', { data: 'data:image/png;base64,' + png.toString('base64') }, auth);
    expect(up.status).toBe(200);
    const { url } = await up.json();
    expect(url).toMatch(/^\/api\/arquivos\/img[0-9a-f]{32}$/);
    const img = await get(url);
    expect(img.status).toBe(200);
    expect(img.headers.get('content-type')).toBe('image/png');
    expect(Buffer.from(await img.arrayBuffer()).equals(png)).toBe(true);
    expect((await get('/api/arquivos/naoexiste')).status).toBe(404);
    // não-imagem rotulada como png é recusada
    const fake = await post('/api/upload', { data: 'data:image/png;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64') }, auth);
    expect(fake.status).toBe(400);
  });

  it('GET /api/config responde 200 com googleClientId', async () => {
    const res = await get('/api/config');
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty('googleClientId');
  });
});
