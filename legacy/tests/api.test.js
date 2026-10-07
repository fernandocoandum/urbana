// Testes de integração: sobem o servidor de verdade (banco JSON local, sem Postgres) numa porta
// dedicada e batem nas rotas via HTTP, como um cliente real faria. Cobrem as validações da Fase 1
// (segurança) e o fluxo principal de negócio (cadastro → login → registrar ocorrência → consultar).
//
// Isolamento: cada arquivo de teste do Vitest roda com seu próprio módulo `server.js` (o require
// não é compartilhado entre arquivos), então este processo tem seu próprio rateLimitStore e sua
// própria instância de `server` — não conflita com tests/unit.test.js nem com um `node server.js`
// rodando à parte para testes manuais.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const path = require('path');
const fs = require('fs');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEST_PORT = 3057;
const BASE = `http://localhost:${TEST_PORT}`;
const DB_FILE = path.join(__dirname, '..', 'db.json');

let mod;

beforeAll(async () => {
  // Sobe numa base limpa: evita que sobras de execuções manuais (rm -f/testes anteriores)
  // colidam com as contagens de rate limit ou com o e-mail único gerado abaixo.
  try { fs.unlinkSync(DB_FILE); } catch {}
  mod = require('../server.js');
  await mod.initDB();
  await new Promise((resolve, reject) => {
    mod.server.listen(TEST_PORT, '127.0.0.1', resolve);
    mod.server.once('error', reject);
  });
}, 20000);

afterAll(async () => {
  await new Promise(resolve => mod.server.close(() => resolve()));
});

function uniqueEmail(prefix) {
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 7)}@teste.com`;
}
async function post(pathname, body, headers = {}) {
  return fetch(`${BASE}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

// E-mail/senha compartilhados entre os blocos de cadastro e login — mantém o total de chamadas a
// /api/cadastro dentro do limite de 8/hora por IP que o próprio rate limiting da Fase 1 aplica
// (todas as chamadas deste arquivo saem do mesmo IP local, então concorrem pelo mesmo balde).
const CONTA_PRINCIPAL = { nome: 'Usuário Teste', email: uniqueEmail('principal'), senha: 'senha123', bairro: 'Centro' };

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

  it('aceita payload de XSS no nome sem quebrar (a defesa é o esc() do front na hora de exibir, não uma recusa aqui)', async () => {
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

describe('Headers de segurança (Fase 1)', () => {
  it('toda resposta HTML inclui os headers de segurança principais', async () => {
    const res = await fetch(`${BASE}/`);
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(res.headers.get('strict-transport-security')).toBeTruthy();
  });

  it('toda resposta de API também carrega os mesmos headers', async () => {
    const res = await fetch(`${BASE}/api/me`);
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('content-security-policy')).toBeTruthy();
  });
});

describe('Autorização em rotas protegidas', () => {
  it('rejeita acesso sem token (401)', async () => {
    const res = await fetch(`${BASE}/api/perfil`);
    expect(res.status).toBe(401);
  });
  it('rejeita token inválido/forjado (401)', async () => {
    const res = await fetch(`${BASE}/api/perfil`, { headers: { Authorization: 'Bearer token-forjado-que-nao-existe' } });
    expect(res.status).toBe(401);
  });
});

describe('Fluxo principal: registrar e consultar uma ocorrência', () => {
  const outraConta = { nome: 'Outro Cidadão', email: uniqueEmail('outro'), senha: 'senha123', bairro: 'Centro' };
  let ocorrenciaId;

  it('exige aceite dos termos de uso antes de registrar uma ocorrência (403)', async () => {
    const res = await post('/api/ocorrencias', {
      titulo: 'Buraco na rua', categoria: 'Pavimentação', endereco: 'Rua Teste, 1', bairro: 'Centro',
    }, { Authorization: `Bearer ${CONTA_PRINCIPAL.token}` });
    expect(res.status).toBe(403);
  });

  it('registra a ocorrência depois de aceitar os termos, com protocolo no formato PROT-AAAA-NNNN e status inicial "Recebida"', async () => {
    const aceite = await post('/api/aceitar-termos', {}, { Authorization: `Bearer ${CONTA_PRINCIPAL.token}` });
    expect(aceite.status).toBe(200);

    const res = await post('/api/ocorrencias', {
      titulo: 'Buraco grande na Rua das Flores', categoria: 'Pavimentação', endereco: 'Rua das Flores, 100', bairro: 'Centro',
    }, { Authorization: `Bearer ${CONTA_PRINCIPAL.token}` });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.protocolo).toMatch(/^PROT-\d{4}-\d{4}$/);
    ocorrenciaId = body.id;

    const det = await fetch(`${BASE}/api/ocorrencias/${ocorrenciaId}`, { headers: { Authorization: `Bearer ${CONTA_PRINCIPAL.token}` } });
    const oc = await det.json();
    expect(oc.status).toBe('Recebida');
    expect(oc.historico).toHaveLength(1);
  });

  it('rejeita categoria e bairro fora das listas fechadas (400)', async () => {
    const res = await post('/api/ocorrencias', {
      titulo: 'X', categoria: 'CategoriaFalsa', endereco: 'Rua X, 1', bairro: 'Centro',
    }, { Authorization: `Bearer ${CONTA_PRINCIPAL.token}` });
    expect(res.status).toBe(400);
  });

  it('rejeita coordenadas de localização inválidas (400)', async () => {
    const res = await post('/api/ocorrencias', {
      titulo: 'X', categoria: 'Pavimentação', endereco: 'Rua X, 1', bairro: 'Centro', lat: 999, lng: 999,
    }, { Authorization: `Bearer ${CONTA_PRINCIPAL.token}` });
    expect(res.status).toBe(400);
  });

  it('bloqueia um cidadão de ver a ocorrência de outro cidadão — escalonamento horizontal de privilégio (403)', async () => {
    await post('/api/cadastro', outraConta);
    const loginOutro = await post('/api/login', { email: outraConta.email, senha: outraConta.senha });
    const { token: tokenOutro } = await loginOutro.json();

    const res = await fetch(`${BASE}/api/ocorrencias/${ocorrenciaId}`, { headers: { Authorization: `Bearer ${tokenOutro}` } });
    expect(res.status).toBe(403);
  });

  it('bloqueia um cidadão comum de alterar o status de uma ocorrência — escalonamento vertical de privilégio (403)', async () => {
    const res = await fetch(`${BASE}/api/ocorrencias/${ocorrenciaId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CONTA_PRINCIPAL.token}` },
      body: JSON.stringify({ status: 'Resolvida' }),
    });
    expect(res.status).toBe(403);
  });
});
