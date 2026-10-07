import { describe, expect, it } from 'vitest';
import {
  FILTROS_VAZIOS,
  filtrarFila,
  filtrosDeSearchParams,
  ordenarFila,
  resumoOperacional,
  searchParamsDeFiltros,
  type FiltrosFila,
} from '@/features/admin/fila';
import { computeDerivedFields } from '@/features/ocorrencias/derived';
import type { Ocorrencia, OcorrenciaDerivada } from '@/lib/db/types';

// 7 out 2026, 15:00 em Braço do Norte (UTC-3)
const AGORA = new Date('2026-10-07T18:00:00.000Z').getTime();
const dia = (n: number) => new Date(AGORA - n * 86400000).toISOString();

function oc(p: Partial<Ocorrencia> & { id: string }): OcorrenciaDerivada {
  const base: Ocorrencia = {
    id: p.id, protocolo: `PROT-${p.id}`, userId: 'u1', titulo: 'Buraco', descricao: '', categoria: 'Pavimentação',
    endereco: 'Rua A, 1', bairro: 'Centro', referencia: '', foto: null, status: 'Recebida', criadoEm: dia(2), atualizadoEm: dia(2),
    historico: [], mensagens: [], nomeUsuario: 'Maria', lat: null, lng: null, apoios: [], avaliacao: null, precisaoLocal: 'manual',
    responsavel: null, setor: null, prazo: null, evidenciaResolucao: null, pedidosReabertura: [], naoLidoAdmin: false, naoLidoCidadao: false,
  };
  return computeDerivedFields({ ...base, ...p }, AGORA);
}

const lista = [
  oc({ id: 'a', titulo: 'Buraco na rua', criadoEm: dia(10), prazo: dia(3), naoLidoAdmin: true }), // atrasada
  oc({ id: 'b', titulo: 'Lâmpada queimada', categoria: 'Iluminação pública', bairro: 'Pinheiral', status: 'Em atendimento', criadoEm: dia(1), apoios: ['x', 'y', 'z'] }),
  oc({
    id: 'c', titulo: 'Entulho', categoria: 'Limpeza urbana', bairro: 'Rio Glória', status: 'Resolvida', criadoEm: dia(5),
    historico: [{ status: 'Recebida', data: dia(5), obs: '' }, { status: 'Resolvida', data: dia(3), obs: '' }],
    pedidosReabertura: [{ motivo: 'voltou', data: dia(1), atendido: false }],
  }),
  oc({ id: 'd', titulo: 'Sinal apagado', categoria: 'Sinalização', status: 'Em análise', criadoEm: dia(40), nomeUsuario: 'José Açaí', prazo: dia(-2) }),
];
const ids = (l: OcorrenciaDerivada[]) => l.map((o) => o.id);
const f = (p: Partial<FiltrosFila>): FiltrosFila => ({ ...FILTROS_VAZIOS, ...p });

describe('filtrarFila', () => {
  it('sem filtros devolve tudo', () => expect(filtrarFila(lista, FILTROS_VAZIOS)).toHaveLength(4));
  it('filtra por status, categoria e bairro', () => {
    expect(ids(filtrarFila(lista, f({ status: 'Em atendimento' })))).toEqual(['b']);
    expect(ids(filtrarFila(lista, f({ categoria: 'Limpeza urbana' })))).toEqual(['c']);
    expect(ids(filtrarFila(lista, f({ bairro: 'Centro' })))).toEqual(['a', 'd']);
  });
  it('busca por protocolo, título e cidadão, ignorando acento e caixa', () => {
    expect(ids(filtrarFila(lista, f({ busca: 'prot-b' })))).toEqual(['b']);
    expect(ids(filtrarFila(lista, f({ busca: 'LAMPADA' })))).toEqual(['b']);
    expect(ids(filtrarFila(lista, f({ busca: 'jose acai' })))).toEqual(['d']);
    expect(filtrarFila(lista, f({ busca: 'nada disso' }))).toEqual([]);
  });
  it('só atrasadas, só não lidas e com reabertura pedida', () => {
    expect(ids(filtrarFila(lista, f({ soAtrasadas: true })))).toEqual(['a']);
    expect(ids(filtrarFila(lista, f({ soNaoLidas: true })))).toEqual(['a']);
    expect(ids(filtrarFila(lista, f({ comReabertura: true })))).toEqual(['c']);
  });
  it('combina filtros (E) e aceita lista vazia', () => {
    expect(filtrarFila(lista, f({ soAtrasadas: true, status: 'Resolvida' }))).toEqual([]);
    expect(filtrarFila([], f({ soAtrasadas: true }))).toEqual([]);
  });
});

describe('ordenarFila', () => {
  it('criticidade é o padrão (atrasada e antiga primeiro) e não altera a lista original', () => {
    const copia = [...lista];
    const r = ordenarFila(lista);
    expect(r[0]!.id).toBe('d');
    expect(r.map((o) => o.criticidade)).toEqual([...r.map((o) => o.criticidade)].sort((x, y) => y - x));
    expect(lista).toEqual(copia);
  });
  it('recentes e antigas', () => {
    expect(ids(ordenarFila(lista, 'recentes'))).toEqual(['b', 'c', 'a', 'd']);
    expect(ids(ordenarFila(lista, 'antigas'))).toEqual(['d', 'a', 'c', 'b']);
  });
  it('apoios', () => expect(ordenarFila(lista, 'apoios')[0]!.id).toBe('b'));
  it('prazo: o mais próximo primeiro; sem prazo e resolvidas vão para o fim', () => {
    const r = ordenarFila(lista, 'prazo');
    expect(ids(r).slice(0, 2)).toEqual(['a', 'd']);
    expect(ids(r).slice(2).sort()).toEqual(['b', 'c']);
  });
});

describe('filtros na URL', () => {
  it('ida e volta', () => {
    const filtros = f({ busca: 'rua', status: 'Em análise', categoria: 'Sinalização', bairro: 'Centro', soAtrasadas: true, soNaoLidas: true, comReabertura: true });
    const sp = searchParamsDeFiltros(filtros, 'prazo');
    expect(filtrosDeSearchParams(sp)).toEqual({ filtros, ordem: 'prazo' });
  });
  it('estado padrão gera URL vazia', () => expect(searchParamsDeFiltros(FILTROS_VAZIOS).toString()).toBe(''));
  it('valores inválidos viram o padrão', () => {
    const sp = new URLSearchParams('status=Qualquer&categoria=x&bairro=y&ordem=zzz&atrasadas=sim');
    expect(filtrosDeSearchParams(sp)).toEqual({ filtros: FILTROS_VAZIOS, ordem: 'criticidade' });
  });
  it('lê o ?busca= que o header do admin empurra', () => {
    expect(filtrosDeSearchParams(new URLSearchParams('busca=PROT-2026-0001')).filtros.busca).toBe('PROT-2026-0001');
  });
});

describe('resumoOperacional', () => {
  const r = resumoOperacional(lista, AGORA);
  it('contagens e taxa de resolução', () => {
    expect(r).toMatchObject({ total: 4, pendentes: 3, emAtendimento: 1, resolvidas: 1, taxaResolucao: 25, atrasadas: 1, naoLidas: 1, comReabertura: 1 });
  });
  it('tempo médio de resolução vem do histórico (2 dias na única resolvida)', () => {
    expect(r.tempoMedioResolucaoDias).toBeCloseTo(2, 5);
    expect(resumoOperacional([lista[0]!], AGORA).tempoMedioResolucaoDias).toBeNull();
  });
  it('série de 30 dias em ordem, no fuso de Braço do Norte', () => {
    expect(r.serie).toHaveLength(30);
    expect(r.serie.at(-1)!.dia).toBe('2026-10-07');
    expect(r.serie[0]!.dia).toBe('2026-09-08');
    expect(r.serie.at(-1)!.rotulo).toBe('07/10');
    // 'b' foi criada ontem; 'd' (40 dias) fica fora da janela
    expect(r.serie.find((p) => p.dia === '2026-10-06')!.criadas).toBe(1);
    expect(r.serie.reduce((s, p) => s + p.criadas, 0)).toBe(3);
    expect(r.serie.find((p) => p.dia === '2026-10-04')!.resolvidas).toBe(1);
  });
  it('um evento às 22h BR (01h UTC do dia seguinte) cai no dia local certo', () => {
    const tarde = oc({ id: 'z', criadoEm: '2026-10-07T01:30:00.000Z' }); // 6 out, 22h30 em BR
    const s = resumoOperacional([tarde], AGORA).serie;
    expect(s.find((p) => p.dia === '2026-10-06')!.criadas).toBe(1);
    expect(s.find((p) => p.dia === '2026-10-07')!.criadas).toBe(0);
  });
  it('categorias e bairros ordenados por volume; lista vazia não quebra', () => {
    expect(r.categorias[0]).toMatchObject({ total: 1 });
    const vazio = resumoOperacional([], AGORA);
    expect(vazio).toMatchObject({ total: 0, taxaResolucao: 0, tempoMedioResolucaoDias: null });
    expect(vazio.serie).toHaveLength(30);
  });
});
