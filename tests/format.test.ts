import { describe, expect, it } from 'vitest';
import { dataDeHojeExtenso, fmtDate, fmtDateTime, initials, saudacaoPorHorario } from '@/lib/format';

describe('fmtDate / fmtDateTime (fuso de São Paulo)', () => {
  it('vazio vira travessão', () => {
    expect(fmtDate(null)).toBe('–');
    expect(fmtDate('')).toBe('–');
    expect(fmtDateTime(undefined)).toBe('–');
  });
  it('usa o dia local de Braço do Norte, não o UTC', () => {
    // 01:30 UTC de 2 de jan = 22:30 de 1º de jan em São Paulo (UTC-3)
    expect(fmtDate('2026-01-02T01:30:00.000Z')).toBe('01/01/2026');
    expect(fmtDateTime('2026-01-02T01:30:00.000Z')).toBe('01/01/2026, 22:30:00');
  });
});

describe('saudacaoPorHorario', () => {
  const em = (utc: string) => saudacaoPorHorario(new Date(utc));
  it('muda pelo horário local', () => {
    expect(em('2026-03-10T07:00:00Z')).toBe('Boa noite'); // 04:00 em SP
    expect(em('2026-03-10T08:00:00Z')).toBe('Bom dia'); // 05:00
    expect(em('2026-03-10T14:59:00Z')).toBe('Bom dia'); // 11:59
    expect(em('2026-03-10T15:00:00Z')).toBe('Boa tarde'); // 12:00
    expect(em('2026-03-10T20:59:00Z')).toBe('Boa tarde'); // 17:59
    expect(em('2026-03-10T21:00:00Z')).toBe('Boa noite'); // 18:00
  });
});

describe('dataDeHojeExtenso', () => {
  it('dia da semana capitalizado, dia e mês por extenso', () => {
    expect(dataDeHojeExtenso(new Date('2026-10-07T15:00:00Z'))).toBe('Quarta-feira, 7 de outubro');
  });
});

describe('initials', () => {
  it('até duas iniciais maiúsculas', () => {
    expect(initials('maria da silva')).toBe('MD');
    expect(initials('Fernando')).toBe('F');
    expect(initials('  ana   lima ')).toBe('AL');
  });
  it('sem nome: "?"', () => {
    expect(initials('')).toBe('?');
    expect(initials(null)).toBe('?');
  });
  it('não quebra com emoji nem com HTML (o React escapa depois)', () => {
    expect(initials('<b> x')).toBe('<X');
    expect(initials('😀 ok')).toBe('😀O');
  });
});
