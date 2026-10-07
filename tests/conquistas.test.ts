import { describe, expect, it } from 'vitest';
import { calcularConquistas } from '@/features/perfil/conquistas';

const ganhas = (st: Parameters<typeof calcularConquistas>[0]) => calcularConquistas(st).filter((c) => c.conquistada).map((c) => c.id);

describe('calcularConquistas', () => {
  it('sempre devolve as 5 conquistas, na mesma ordem', () => {
    expect(calcularConquistas({}).map((c) => c.id)).toEqual(['primeiro-registro', 'olho-vivo', 'problema-resolvido', 'vizinho-solidario', 'guardiao']);
  });
  it('sem atividade nenhuma está desbloqueada', () => {
    expect(ganhas({})).toEqual([]);
  });
  it('primeiro registro com 1 ocorrência; olho vivo com 5', () => {
    expect(ganhas({ ocorrencias: 1 })).toEqual(['primeiro-registro']);
    expect(ganhas({ ocorrencias: 4 })).toEqual(['primeiro-registro']);
    expect(ganhas({ ocorrencias: 5 })).toEqual(['primeiro-registro', 'olho-vivo']);
  });
  it('problema resolvido com 1 resolvida; vizinho solidário com 3 apoios', () => {
    expect(ganhas({ resolvidas: 1 })).toEqual(['problema-resolvido']);
    expect(ganhas({ apoiosDados: 2 })).toEqual([]);
    expect(ganhas({ apoiosDados: 3 })).toEqual(['vizinho-solidario']);
  });
  it('guardião só no nível 4 (150 pts)', () => {
    expect(ganhas({ ocorrencias: 14, resolvidas: 0, apoiosDados: 4 })).not.toContain('guardiao'); // 148
    expect(ganhas({ ocorrencias: 15 })).toContain('guardiao');
  });
  it('toda bloqueada tem dica de como ganhar', () => {
    for (const c of calcularConquistas({})) expect(c.dica.length).toBeGreaterThan(5);
  });
});
