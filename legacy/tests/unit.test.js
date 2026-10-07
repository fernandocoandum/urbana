// Testes unitários das funções puras de server.js — senha, validações e assinatura de arquivo.
// Não sobem servidor nem tocam banco de dados (por isso são rápidos e não precisam de setup):
// server.js só exporta essas funções e não inicia o listen() quando é `require`ido em vez de
// rodado diretamente com `node server.js` (ver o guard `require.main === module` no fim do arquivo).
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const {
  hashPassword, verifyPassword, isLegacyHash,
  cap, isCoordenadaValida, isOwnUploadUrl, assinaturaImagemValida,
  rateLimit, genToken,
  EMAIL_RE, BAIRROS_VALIDOS, CATEGORIAS_VALIDAS, STATUS_VALIDOS,
} = require('../server.js');

describe('hashPassword / verifyPassword', () => {
  it('gera hash no formato scrypt:salt:derivado', () => {
    const hash = hashPassword('minhaSenha123');
    expect(hash.startsWith('scrypt:')).toBe(true);
    expect(hash.split(':')).toHaveLength(3);
  });

  it('senhas iguais geram hashes diferentes (salt aleatório por usuário)', () => {
    const a = hashPassword('mesmaSenha');
    const b = hashPassword('mesmaSenha');
    expect(a).not.toBe(b);
  });

  it('verifica a senha correta como válida', () => {
    const hash = hashPassword('correta123');
    expect(verifyPassword('correta123', hash)).toBe(true);
  });

  it('rejeita a senha incorreta', () => {
    const hash = hashPassword('correta123');
    expect(verifyPassword('errada456', hash)).toBe(false);
  });

  it('rejeita quando o valor armazenado é vazio/nulo', () => {
    expect(verifyPassword('qualquer', null)).toBe(false);
    expect(verifyPassword('qualquer', '')).toBe(false);
  });

  it('rejeita quando a senha enviada não é string (payload malformado)', () => {
    const hash = hashPassword('correta123');
    expect(verifyPassword(12345, hash)).toBe(false);
    expect(verifyPassword({ senha: 'x' }, hash)).toBe(false);
    expect(verifyPassword(undefined, hash)).toBe(false);
  });

  it('ainda verifica contas legadas (sha256 sem salt, formato pré-scrypt)', () => {
    const crypto = require('crypto');
    const legacyHash = crypto.createHash('sha256').update('senhaAntiga').digest('hex');
    expect(verifyPassword('senhaAntiga', legacyHash)).toBe(true);
    expect(verifyPassword('senhaErrada', legacyHash)).toBe(false);
  });
});

describe('isLegacyHash', () => {
  it('identifica hash scrypt como não-legado', () => {
    expect(isLegacyHash(hashPassword('x'))).toBe(false);
  });
  it('identifica hash sha256 puro como legado', () => {
    const crypto = require('crypto');
    expect(isLegacyHash(crypto.createHash('sha256').update('x').digest('hex'))).toBe(true);
  });
  it('trata valor vazio como não-legado (evita erro em cascata)', () => {
    expect(isLegacyHash(null)).toBe(false);
    expect(isLegacyHash('')).toBe(false);
  });
});

describe('cap (normalização de texto)', () => {
  it('remove espaços das pontas e corta no tamanho máximo', () => {
    expect(cap('  Fernando  ', 100)).toBe('Fernando');
    expect(cap('a'.repeat(300), 100)).toHaveLength(100);
  });
  it('devolve o valor original quando não é string (não força conversão)', () => {
    expect(cap(123, 10)).toBe(123);
    expect(cap(null, 10)).toBe(null);
    expect(cap(undefined, 10)).toBe(undefined);
  });
  it('não quebra com payload de HTML/script — só corta o texto, não sanitiza (isso é feito no front com esc() na hora de exibir)', () => {
    const payload = '<script>alert(1)</script>';
    expect(cap(payload, 100)).toBe(payload);
  });
});

describe('EMAIL_RE (validação de e-mail no cadastro)', () => {
  it('aceita e-mails válidos', () => {
    expect(EMAIL_RE.test('fernando@exemplo.com')).toBe(true);
    expect(EMAIL_RE.test('nome.sobrenome@dominio.com.br')).toBe(true);
  });
  it('rejeita e-mails claramente inválidos', () => {
    expect(EMAIL_RE.test('nao-e-email')).toBe(false);
    expect(EMAIL_RE.test('sem-arroba.com')).toBe(false);
    expect(EMAIL_RE.test('')).toBe(false);
    expect(EMAIL_RE.test('a@b')).toBe(false);
  });
  it('rejeita payloads de injeção disfarçados de e-mail', () => {
    expect(EMAIL_RE.test("' OR 1=1--@x.com")).toBe(false); // tem espaço, então falha
    expect(EMAIL_RE.test('<script>@x.com')).toBe(true); // regex simples só olha formato — a proteção real contra XSS é o esc() na hora de exibir, não a regex de e-mail
  });
});

describe('BAIRROS_VALIDOS / CATEGORIAS_VALIDAS / STATUS_VALIDOS (listas fechadas)', () => {
  it('só aceita os bairros da lista fechada', () => {
    expect(BAIRROS_VALIDOS.has('Centro')).toBe(true);
    expect(BAIRROS_VALIDOS.has('BairroInventado')).toBe(false);
    expect(BAIRROS_VALIDOS.has('<script>alert(1)</script>')).toBe(false);
  });
  it('só aceita categorias da lista fechada', () => {
    expect(CATEGORIAS_VALIDAS.has('Pavimentação')).toBe(true);
    expect(CATEGORIAS_VALIDAS.has('CategoriaFalsa')).toBe(false);
  });
  it('só aceita status da lista fechada (protege a máquina de estados da ocorrência)', () => {
    expect(STATUS_VALIDOS.has('Resolvida')).toBe(true);
    expect(STATUS_VALIDOS.has('Cancelada')).toBe(false); // status que não existe no fluxo
  });
});

describe('isCoordenadaValida', () => {
  it('aceita coordenadas dentro do intervalo válido', () => {
    expect(isCoordenadaValida(-28.27, -49.17)).toBe(true);
    expect(isCoordenadaValida(0, 0)).toBe(true);
    expect(isCoordenadaValida(90, 180)).toBe(true);
    expect(isCoordenadaValida(-90, -180)).toBe(true);
  });
  it('rejeita coordenadas fora do intervalo (lat/lng invertidos ou absurdos)', () => {
    expect(isCoordenadaValida(200, 0)).toBe(false);
    expect(isCoordenadaValida(0, -200)).toBe(false);
    expect(isCoordenadaValida(-91, 0)).toBe(false);
  });
  it('rejeita valores não numéricos, NaN, Infinity ou ausentes', () => {
    expect(isCoordenadaValida('-28.27', '-49.17')).toBe(false); // strings, não number
    expect(isCoordenadaValida(NaN, 0)).toBe(false);
    expect(isCoordenadaValida(Infinity, 0)).toBe(false);
    expect(isCoordenadaValida(undefined, undefined)).toBe(false);
    expect(isCoordenadaValida(null, null)).toBe(false);
  });
});

describe('isOwnUploadUrl (evita que o campo "foto" vire vetor de XSS/URL arbitrária)', () => {
  it('aceita null/undefined (sem foto) e a própria rota de upload', () => {
    expect(isOwnUploadUrl(null)).toBe(true);
    expect(isOwnUploadUrl(undefined)).toBe(true);
    expect(isOwnUploadUrl('/api/arquivos/img1a2b3c')).toBe(true);
  });
  it('rejeita URLs externas, javascript: e payloads de XSS', () => {
    expect(isOwnUploadUrl('https://evil.com/malware.png')).toBe(false);
    expect(isOwnUploadUrl('javascript:alert(1)')).toBe(false);
    expect(isOwnUploadUrl('"><img src=x onerror=alert(1)>')).toBe(false);
    expect(isOwnUploadUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });
  it('rejeita caminhos parecidos mas fora do formato exato (path traversal, query string extra)', () => {
    expect(isOwnUploadUrl('/api/arquivos/../../etc/passwd')).toBe(false);
    expect(isOwnUploadUrl('/api/arquivos/abc?x=1')).toBe(false);
    expect(isOwnUploadUrl('/api/arquivos/')).toBe(false);
  });
});

describe('assinaturaImagemValida (checa os bytes reais do arquivo, não só o Content-Type declarado)', () => {
  it('aceita PNG com assinatura correta', () => {
    const png = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0,0,0,0]);
    expect(assinaturaImagemValida('image/png', png)).toBe(true);
  });
  it('aceita JPEG com assinatura correta', () => {
    const jpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0,0,0,0,0,0,0,0]);
    expect(assinaturaImagemValida('image/jpeg', jpeg)).toBe(true);
  });
  it('aceita GIF87a e GIF89a', () => {
    expect(assinaturaImagemValida('image/gif', Buffer.from('GIF89a' + '\0\0\0\0\0\0'))).toBe(true);
    expect(assinaturaImagemValida('image/gif', Buffer.from('GIF87a' + '\0\0\0\0\0\0'))).toBe(true);
  });
  it('aceita WEBP com assinatura RIFF/WEBP correta', () => {
    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0,0,0,0]), Buffer.from('WEBP')]);
    expect(assinaturaImagemValida('image/webp', webp)).toBe(true);
  });
  it('REJEITA um arquivo que não é imagem mas se declara como image/png (o ataque que essa função existe para bloquear)', () => {
    // Conteúdo de um script/HTML disfarçado de PNG via Content-Type/MIME mentiroso
    const fakePng = Buffer.from('<script>alert(document.cookie)</script>');
    expect(assinaturaImagemValida('image/png', fakePng)).toBe(false);
  });
  it('rejeita buffer pequeno demais para conter uma assinatura válida', () => {
    expect(assinaturaImagemValida('image/png', Buffer.from([0x89, 0x50]))).toBe(false);
  });
  it('rejeita MIME fora da lista suportada', () => {
    const png = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0,0,0,0]);
    expect(assinaturaImagemValida('image/svg+xml', png)).toBe(false); // SVG pode conter <script> — não é permitido
    expect(assinaturaImagemValida('application/octet-stream', png)).toBe(false);
  });
});

describe('rateLimit (limita tentativas por chave/janela — proteção de força bruta)', () => {
  it('libera requisições dentro do limite', () => {
    const key = 'test:' + genToken();
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, 5, 60000).limited).toBe(false);
    }
  });
  it('bloqueia a partir da requisição que excede o limite', () => {
    const key = 'test:' + genToken();
    for (let i = 0; i < 5; i++) rateLimit(key, 5, 60000);
    const sixth = rateLimit(key, 5, 60000);
    expect(sixth.limited).toBe(true);
    expect(sixth.retryAfter).toBeGreaterThan(0);
  });
  it('chaves diferentes têm contadores independentes', () => {
    const keyA = 'test:' + genToken();
    const keyB = 'test:' + genToken();
    for (let i = 0; i < 5; i++) rateLimit(keyA, 5, 60000);
    expect(rateLimit(keyA, 5, 60000).limited).toBe(true);
    expect(rateLimit(keyB, 5, 60000).limited).toBe(false);
  });
});

describe('genToken', () => {
  it('gera token hexadecimal de 64 caracteres (32 bytes) e sempre diferente', () => {
    const a = genToken();
    const b = genToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});
