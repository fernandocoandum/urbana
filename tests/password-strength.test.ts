import { describe, expect, it } from 'vitest';
import { avaliarSenha, contemDadosPessoais, contemSenhaComum, requisitosDe, temRepeticao, temSequencia } from '@/features/auth/password-strength';

describe('requisitosDe', () => {
  it('detecta cada requisito do checklist', () => {
    expect(requisitosDe('abc')).toEqual({ tamanho: false, maiusculaMinuscula: false, numero: false, simbolo: false });
    expect(requisitosDe('Abcdefgh1!')).toEqual({ tamanho: true, maiusculaMinuscula: true, numero: true, simbolo: true });
  });
  it('maiúscula e minúscula precisam aparecer juntas', () => {
    expect(requisitosDe('ABCDEFGH').maiusculaMinuscula).toBe(false);
    expect(requisitosDe('abcdefgh').maiusculaMinuscula).toBe(false);
    expect(requisitosDe('abcdefGh').maiusculaMinuscula).toBe(true);
  });
  it('acentuadas contam como letras, não como símbolo', () => {
    expect(requisitosDe('Ação').simbolo).toBe(false);
    expect(requisitosDe('ação!').simbolo).toBe(true);
  });
});

describe('padrões', () => {
  it('sequências de 4+ (crescentes e decrescentes)', () => {
    expect(temSequencia('xx1234xx')).toBe(true);
    expect(temSequencia('abcd')).toBe(true);
    expect(temSequencia('9876')).toBe(true);
    expect(temSequencia('123')).toBe(false);
    expect(temSequencia('a1b2c3')).toBe(false);
  });
  it('repetição de 3+', () => {
    expect(temRepeticao('aaab')).toBe(true);
    expect(temRepeticao('aabb')).toBe(false);
  });
  it('senhas comuns (sem acento, sem diferenciar caixa) e termos do Urbana', () => {
    for (const s of ['123456', 'Senha', 'PASSWORD', 'qwerty', 'abc123', '111111', 'Braço', 'URBANA']) expect(contemSenhaComum(s)).toBe(true);
    expect(contemSenhaComum('k9#Tr!vQ')).toBe(false);
    expect(contemSenhaComum('MinhaSenhaForte')).toBe(true); // contém "senha"
  });
  it('nome e prefixo do e-mail', () => {
    const ctx = { nome: 'Fernando Coan', email: 'fcoan.dev@exemplo.com' };
    expect(contemDadosPessoais('fernando99', ctx)).toBe(true);
    expect(contemDadosPessoais('xCOANx', ctx)).toBe(true);
    expect(contemDadosPessoais('fcoan.dev1', ctx)).toBe(true);
    expect(contemDadosPessoais('zqk', ctx)).toBe(false);
    // partes curtas (< 3 letras) do nome não disparam
    expect(contemDadosPessoais('mademo', { nome: 'Ma De' })).toBe(false);
  });
});

describe('avaliarSenha', () => {
  it('vazia: nível 0, sem rótulo', () => {
    const a = avaliarSenha('');
    expect(a.nivel).toBe(0);
    expect(a.rotulo).toBeNull();
    expect(a.avisos).toEqual([]);
  });
  it('níveis 1 a 4 com os rótulos do plano', () => {
    expect(avaliarSenha('abc').rotulo).toBe('Muito fraca');
    expect(avaliarSenha('abcdefgh').nivel).toBe(1);
    expect(avaliarSenha('Kjhtfdsq').rotulo).toBe('Fraca'); // tamanho + maiúscula/minúscula
    expect(avaliarSenha('Kjhtfdsq7').rotulo).toBe('Boa');
    expect(avaliarSenha('Kjh!fdsq7').rotulo).toBe('Forte');
  });
  it('senha comum força "Muito fraca" mesmo cumprindo os requisitos', () => {
    const a = avaliarSenha('Urbana#2026x');
    expect(a.nivel).toBe(1);
    expect(a.avisos.length).toBeGreaterThan(0);
  });
  it('sequência, repetição e dados pessoais rebaixam um nível e geram aviso', () => {
    const base = avaliarSenha('Kjh!fdsq7');
    const rep = avaliarSenha('Kjh!fdsqq7');
    expect(base.nivel).toBe(4);
    expect(avaliarSenha('Kjh!fdsq7777').nivel).toBeLessThan(4);
    expect(rep.nivel).toBe(4); // dois q seguidos não é repetição de 3
    const pessoal = avaliarSenha('Fernando!9', { nome: 'Fernando Coan' });
    expect(pessoal.avisos.some((a) => /nome/.test(a))).toBe(true);
    expect(pessoal.nivel).toBeLessThan(4);
  });
  it('nunca fica abaixo de 1 para senha não vazia, nem acima de 4', () => {
    for (const s of ['1', 'aaaa', '1234', 'Zq!9Zq!9Zq!9']) {
      const n = avaliarSenha(s).nivel;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(4);
    }
  });
});
