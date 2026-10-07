import { describe, expect, it } from 'vitest';
import { coordenadasComoTexto, enderecoDoGps, escolherBairro, interpretarSugestao } from '@/features/ocorrencias/wizard/geo';
import { camposObrigatoriosOk, estadoInicial, montarPayload, proximoPasso, reducer, validarPasso, WZ_TITLES } from '@/features/ocorrencias/wizard/state';
import { formatarDataTicket, gerarBarras } from '@/features/ocorrencias/wizard/ticket-utils';

describe('validarPasso (mensagens do legado)', () => {
  const vazio = { categoria: '', bairro: '', endereco: '', titulo: '' };
  it('passo 1 exige categoria', () => {
    expect(validarPasso(1, vazio)).toBe('Escolha uma categoria para continuar.');
    expect(validarPasso(1, { ...vazio, categoria: 'Outros' })).toBeNull();
  });
  it('passo 2 exige bairro e endereço (espaços não contam)', () => {
    expect(validarPasso(2, { ...vazio, bairro: 'Centro', endereco: '   ' })).toBe('Preencha bairro e endereço.');
    expect(validarPasso(2, { ...vazio, bairro: 'Centro', endereco: 'Rua A, 1' })).toBeNull();
  });
  it('passo 3 exige título; passo 4 não valida nada aqui', () => {
    expect(validarPasso(3, vazio)).toBe('Dê um título curto para a ocorrência.');
    expect(validarPasso(3, { ...vazio, titulo: ' x ' })).toBeNull();
    expect(validarPasso(4, vazio)).toBeNull();
  });
  it('camposObrigatoriosOk reúne os quatro campos', () => {
    expect(camposObrigatoriosOk({ categoria: 'Outros', bairro: 'Centro', endereco: 'Rua', titulo: 'T' })).toBe(true);
    expect(camposObrigatoriosOk({ categoria: 'Outros', bairro: '', endereco: 'Rua', titulo: 'T' })).toBe(false);
  });
});

describe('reducer do wizard', () => {
  it('a direção da animação segue o sentido do passo', () => {
    const s2 = reducer(estadoInicial, { type: 'ir', step: 2 });
    expect(s2.dir).toBe(1);
    expect(reducer(s2, { type: 'ir', step: 1 }).dir).toBe(-1);
  });
  it('"Editar" na revisão volta para a revisão ao concluir o passo', () => {
    let s = reducer(estadoInicial, { type: 'ir', step: 4 });
    s = reducer(s, { type: 'ir', step: 2, retorno: true });
    expect(s.retorno).toBe(true);
    expect(proximoPasso(s)).toBe(4);
    s = reducer(s, { type: 'ir', step: 4 });
    expect(s.retorno).toBe(false);
    expect(proximoPasso({ step: 2, retorno: false })).toBe(3);
  });
  it('mover o pin grava precisão manual; o GPS grava gps', () => {
    let s = reducer(estadoInicial, { type: 'local', lat: -28.27, lng: -49.17, precisao: 'gps' });
    expect(s.precisao).toBe('gps');
    s = reducer(s, { type: 'local', lat: -28.28, lng: -49.18, precisao: 'manual' });
    expect(s).toMatchObject({ lat: -28.28, lng: -49.18, precisao: 'manual' });
  });
  it('trocar de passo limpa o aviso de campos faltando', () => {
    const s = reducer(reducer(estadoInicial, { type: 'tentou' }), { type: 'ir', step: 2 });
    expect(s.tentou).toBe(false);
  });
  it('todos os passos têm título e subtítulo', () => {
    expect(WZ_TITLES[1][0]).toBe('O que você quer relatar?');
    expect(Object.keys(WZ_TITLES)).toHaveLength(4);
  });
});

describe('montarPayload', () => {
  const base = { ...estadoInicial, categoria: 'Pavimentação', bairro: 'Centro', endereco: ' Rua A, 42 ', titulo: ' Buraco ', descricao: ' d ', referencia: ' perto ' };
  it('apara os textos e omite coordenadas quando não há ponto', () => {
    expect(montarPayload(base, null)).toEqual({ titulo: 'Buraco', descricao: 'd', categoria: 'Pavimentação', bairro: 'Centro', endereco: 'Rua A, 42', referencia: 'perto', foto: null, lat: undefined, lng: undefined, precisao: undefined });
  });
  it('inclui lat, lng e precisão quando há ponto', () => {
    const p = montarPayload({ ...base, lat: -28.27, lng: -49.17, precisao: 'gps' }, '/api/arquivos/img1');
    expect(p).toMatchObject({ lat: -28.27, lng: -49.17, precisao: 'gps', foto: '/api/arquivos/img1' });
  });
});

describe('geolocalização (port de usarLocalizacao)', () => {
  it('escolherBairro casa nos dois sentidos, sem diferenciar caixa', () => {
    expect(escolherBairro('centro')).toBe('Centro');
    expect(escolherBairro('Bairro Pinheiral')).toBe('Pinheiral');
    expect(escolherBairro('Rio Glória')).toBe('Rio Glória');
    expect(escolherBairro('')).toBeUndefined();
    expect(escolherBairro(null)).toBeUndefined();
    expect(escolherBairro('Lugar nenhum')).toBeUndefined();
  });
  it('enderecoDoGps usa rua e número, depois o endereço sugerido, depois as coordenadas', () => {
    expect(enderecoDoGps({ rua: 'Rua A', numero: '10' }, 1, 2)).toBe('Rua A, 10');
    expect(enderecoDoGps({ rua: 'Rua A' }, 1, 2)).toBe('Rua A');
    expect(enderecoDoGps({ enderecoSugerido: 'Rua B, Centro, Braço do Norte' }, 1, 2)).toBe('Rua B, Centro');
    expect(enderecoDoGps({}, -28.2761234, -49.1712)).toBe('Lat -28.27612, Lng -49.17120');
    expect(coordenadasComoTexto(1, 2)).toBe('Lat 1.00000, Lng 2.00000');
  });
  it('interpretarSugestao tira o endereço curto e acha o bairro', () => {
    expect(interpretarSugestao('Rua Nereu Ramos, Centro, Braço do Norte, SC, Brasil')).toEqual({ endereco: 'Rua Nereu Ramos, Centro', bairro: 'Centro' });
    expect(interpretarSugestao('Rua X, Sei lá, Braço do Norte')).toEqual({ endereco: 'Rua X, Sei lá', bairro: undefined });
  });
});

describe('ticket', () => {
  it('as barras do código são determinísticas e cabem em 250', () => {
    const a = gerarBarras('PROT-2026-0001');
    expect(a).toHaveLength(60);
    expect(gerarBarras('PROT-2026-0001')).toEqual(a);
    expect(gerarBarras('PROT-2026-0002')).not.toEqual(a);
    expect(a.every((b) => b.w === 1.5 || b.w === 2.5)).toBe(true);
    const ultimo = a[a.length - 1]!;
    expect(a[0]!.x).toBeGreaterThanOrEqual(0);
    expect(ultimo.x + ultimo.w).toBeLessThanOrEqual(250.01);
  });
  it('a data sai como no legado, no fuso de São Paulo', () => {
    expect(formatarDataTicket(new Date('2026-10-07T17:30:00Z'))).toBe('7 out 2026 • 14:30');
  });
});
