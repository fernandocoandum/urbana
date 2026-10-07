import { describe, expect, it } from 'vitest';
import {
  BAIRRO_CENTROS,
  filtrarPontos,
  jitterFromId,
  pesoCalor,
  posicaoDoPonto,
  rankingBairros,
  tamanhoCluster,
  type PontoMapa,
} from '@/features/mapa/mapa-utils';

const ponto = (o: Partial<PontoMapa>): PontoMapa => ({
  id: 'oc1', protocolo: 'URB-1', titulo: 't', categoria: 'Pavimentação', status: 'Recebida', bairro: 'Centro',
  lat: null, lng: null, apoios: 0, apoiado: false, isMine: false, nomeUsuario: null, precisaoLocal: 'aproximado', ...o,
});

describe('jitterFromId', () => {
  it('é determinístico e respeita o limite', () => {
    const a = jitterFromId('oc1700000000000abc', 0.006);
    expect(jitterFromId('oc1700000000000abc', 0.006)).toEqual(a);
    expect(Math.abs(a[0])).toBeLessThanOrEqual(0.006);
    expect(Math.abs(a[1])).toBeLessThanOrEqual(0.006);
    expect(jitterFromId('outro-id', 0.006)).not.toEqual(a);
  });
});

describe('posicaoDoPonto', () => {
  it('usa a coordenada real quando existe', () => {
    expect(posicaoDoPonto(ponto({ lat: -28.27, lng: -49.17, precisaoLocal: 'gps' }))).toEqual({ lat: -28.27, lng: -49.17, aproximado: false });
  });
  it('marca como aproximada uma coordenada de precisão "aproximado"', () => {
    expect(posicaoDoPonto(ponto({ lat: -28.27, lng: -49.17, precisaoLocal: 'aproximado' })).aproximado).toBe(true);
  });
  it('sem coordenada cai no centro do bairro com jitter pequeno', () => {
    const p = posicaoDoPonto(ponto({ bairro: 'Pinheiral' }));
    const [clat, clng] = BAIRRO_CENTROS['Pinheiral']!;
    expect(p.aproximado).toBe(true);
    expect(Math.abs(p.lat - clat)).toBeLessThanOrEqual(0.006);
    expect(Math.abs(p.lng - clng)).toBeLessThanOrEqual(0.006);
  });
});

describe('pesoCalor', () => {
  it('0,4 base + 0,06 por apoio, com teto em 10', () => {
    expect(pesoCalor(0)).toBeCloseTo(0.4);
    expect(pesoCalor(5)).toBeCloseTo(0.7);
    expect(pesoCalor(10)).toBeCloseTo(1);
    expect(pesoCalor(99)).toBeCloseTo(1);
  });
});

describe('filtrarPontos', () => {
  const lista = [
    ponto({ id: 'a', categoria: 'Pavimentação', status: 'Recebida', isMine: true }),
    ponto({ id: 'b', categoria: 'Limpeza urbana', status: 'Resolvida' }),
    ponto({ id: 'c', categoria: 'Limpeza urbana', status: 'Recebida', isMine: true }),
  ];
  it('sem filtros devolve tudo', () => {
    expect(filtrarPontos(lista, { categorias: [], status: 'todos', soMinhas: false })).toHaveLength(3);
  });
  it('filtra por categoria (multi), status e "só as minhas" em conjunto', () => {
    expect(filtrarPontos(lista, { categorias: ['Limpeza urbana'], status: 'todos', soMinhas: false }).map((p) => p.id)).toEqual(['b', 'c']);
    expect(filtrarPontos(lista, { categorias: ['Limpeza urbana', 'Pavimentação'], status: 'Recebida', soMinhas: false }).map((p) => p.id)).toEqual(['a', 'c']);
    expect(filtrarPontos(lista, { categorias: ['Limpeza urbana'], status: 'Recebida', soMinhas: true }).map((p) => p.id)).toEqual(['c']);
  });
});

describe('rankingBairros e tamanhoCluster', () => {
  it('ordena por contagem, desempata por nome e limita', () => {
    const r = rankingBairros(
      [...Array(3).fill({ bairro: 'Centro' }), ...Array(3).fill({ bairro: 'Pinheiral' }), { bairro: 'Rio Glória' }, { bairro: 'Santa Clara' }, { bairro: 'São Maurício' }, { bairro: 'Outro' }],
      3,
    );
    expect(r.map((b) => [b.bairro, b.total])).toEqual([['Centro', 3], ['Pinheiral', 3], ['Outro', 1]]);
    expect(r[0]!.centro).toEqual(BAIRRO_CENTROS['Centro']);
  });
  it('tamanho do cluster por faixa', () => {
    expect([tamanhoCluster(2), tamanhoCluster(9), tamanhoCluster(10), tamanhoCluster(49), tamanhoCluster(50)]).toEqual([36, 36, 44, 44, 52]);
  });
});
