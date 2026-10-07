import { describe, expect, it } from 'vitest';
import { responderUrbaninha, URBANINHA_FALLBACK, URBANINHA_REGRAS, URBANINHA_SUGESTOES } from '@/features/urbaninha/rules';

describe('Urbaninha', () => {
  const resposta = (t: string) => responderUrbaninha(t, () => 0);
  it('cada sugestão cai na regra certa', () => {
    expect(resposta(URBANINHA_SUGESTOES[0]!)).toBe(URBANINHA_REGRAS[1]!.respostas[0]); // registrar
    expect(resposta(URBANINHA_SUGESTOES[1]!)).toBe(URBANINHA_REGRAS[2]!.respostas[0]); // senha
    expect(resposta(URBANINHA_SUGESTOES[2]!)).toBe(URBANINHA_REGRAS[3]!.respostas[0]); // status
    expect(resposta(URBANINHA_SUGESTOES[3]!)).toBe(URBANINHA_REGRAS[5]!.respostas[0]); // fotos
  });
  it('saudação, agradecimento e "você é robô"', () => {
    expect(resposta('Olá')).toContain('Eu sou a Urbaninha');
    expect(resposta('valeu!')).toContain('Disponha');
    expect(resposta('você é robô?')).toContain('respostas prontas');
  });
  it('sem correspondência devolve o fallback', () => {
    expect(resposta('xyzzy')).toBe(URBANINHA_FALLBACK[0]);
  });
});
