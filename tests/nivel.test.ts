import { describe, expect, it } from 'vitest';
import { calcularNivel } from '@/features/perfil/nivel';

describe('calcularNivel (port de calcularNivelPerfil)', () => {
  it('sem atividade: iniciante, faltam 20 pts, barra mínima de 4%', () => {
    expect(calcularNivel({})).toMatchObject({ pontos: 0, indice: 0, nome: 'Cidadão iniciante', icone: 'sprout', proximo: 'Cidadão ativo', faltam: 20, progresso: 4 });
  });
  it('pontua ocorrência 10, resolvida +5, apoio +2', () => {
    expect(calcularNivel({ ocorrencias: 2, resolvidas: 1, apoiosDados: 3 }).pontos).toBe(31);
  });
  it('limites de nível: 20, 60 e 150', () => {
    expect(calcularNivel({ ocorrencias: 2 })).toMatchObject({ pontos: 20, nome: 'Cidadão ativo', icone: 'building' });
    expect(calcularNivel({ ocorrencias: 6 })).toMatchObject({ pontos: 60, nome: 'Colaborador da cidade', icone: 'handshake' });
    expect(calcularNivel({ ocorrencias: 15 })).toMatchObject({ pontos: 150, nome: 'Guardião do Urbana', icone: 'shield', indice: 3 });
  });
  it('progresso em % dentro do nível e faltam até o próximo', () => {
    // 31 pts: nível 1 (20..60) → (31-20)/40 = 27,5% → 28
    expect(calcularNivel({ ocorrencias: 2, resolvidas: 1, apoiosDados: 3 })).toMatchObject({ progresso: 28, faltam: 29, proximo: 'Colaborador da cidade' });
  });
  it('nível máximo: sem próximo, 100%', () => {
    expect(calcularNivel({ ocorrencias: 40 })).toMatchObject({ proximo: null, faltam: 0, progresso: 100 });
  });
});
