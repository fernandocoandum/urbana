import { describe, expect, it } from 'vitest';
import { agruparMensagens, chaveDoDia, rotuloDoDia } from '@/features/chat/agrupar-mensagens';

const m = (id: string, autor: string, data: string) => ({ id, autor, data });
// 12:00 UTC = 09:00 em São Paulo (UTC-3)
const AGORA = new Date('2026-10-07T15:00:00Z');

describe('agruparMensagens', () => {
  it('lista vazia não gera dias', () => {
    expect(agruparMensagens([], AGORA)).toEqual([]);
  });
  it('mesmo autor com menos de 5 min vira um grupo só', () => {
    const dias = agruparMensagens([m('1', 'a', '2026-10-07T12:00:00Z'), m('2', 'a', '2026-10-07T12:03:00Z'), m('3', 'a', '2026-10-07T12:06:30Z')], AGORA);
    expect(dias).toHaveLength(1);
    expect(dias[0]!.grupos).toHaveLength(1);
    expect(dias[0]!.grupos[0]!.mensagens.map((x) => x.id)).toEqual(['1', '2', '3']);
  });
  it('o intervalo é medido entre mensagens consecutivas: 5 min exatos quebra o grupo', () => {
    const dias = agruparMensagens([m('1', 'a', '2026-10-07T12:00:00Z'), m('2', 'a', '2026-10-07T12:05:00Z')], AGORA);
    expect(dias[0]!.grupos.map((g) => g.mensagens.length)).toEqual([1, 1]);
  });
  it('autor diferente quebra o grupo, e voltar ao primeiro abre outro', () => {
    const dias = agruparMensagens([m('1', 'a', '2026-10-07T12:00:00Z'), m('2', 'b', '2026-10-07T12:01:00Z'), m('3', 'a', '2026-10-07T12:02:00Z')], AGORA);
    expect(dias[0]!.grupos.map((g) => g.autor)).toEqual(['a', 'b', 'a']);
  });
  it('separa por dia no fuso de São Paulo, não em UTC', () => {
    // 01:30 UTC de 7/10 ainda é 6/10 em SP; 03:30 UTC já é 7/10
    const dias = agruparMensagens([m('1', 'a', '2026-10-07T01:30:00Z'), m('2', 'a', '2026-10-07T03:30:00Z')], AGORA);
    expect(dias.map((d) => d.chave)).toEqual(['2026-10-06', '2026-10-07']);
    expect(dias.map((d) => d.rotulo)).toEqual(['Ontem', 'Hoje']);
  });
  it('mesmo autor, poucos minutos, mas virando o dia: grupos diferentes', () => {
    const dias = agruparMensagens([m('1', 'a', '2026-10-07T02:58:00Z'), m('2', 'a', '2026-10-07T03:01:00Z')], AGORA);
    expect(dias).toHaveLength(2);
  });
  it('mantém a ordem recebida', () => {
    const dias = agruparMensagens([m('x', 'a', '2026-10-05T15:00:00Z'), m('y', 'b', '2026-10-07T15:00:00Z')], AGORA);
    expect(dias.flatMap((d) => d.grupos.flatMap((g) => g.mensagens.map((x) => x.id)))).toEqual(['x', 'y']);
  });
});

describe('rotuloDoDia', () => {
  it('Hoje, Ontem, data por extenso e com ano quando é de outro ano', () => {
    expect(rotuloDoDia('2026-10-07', AGORA)).toBe('Hoje');
    expect(rotuloDoDia('2026-10-06', AGORA)).toBe('Ontem');
    expect(rotuloDoDia('2026-09-12', AGORA)).toBe('12 de setembro');
    expect(rotuloDoDia('2025-12-31', AGORA)).toBe('31 de dezembro de 2025');
  });
  it('chaveDoDia usa o fuso de São Paulo', () => {
    expect(chaveDoDia('2026-01-02T01:30:00Z')).toBe('2026-01-01');
  });
});
