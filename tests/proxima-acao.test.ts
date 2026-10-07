import { describe, expect, it } from 'vitest';
import { pedidoPendente, proximaAcaoAdminTexto, proximaAcaoTexto } from '@/features/ocorrencias/proxima-acao';

describe('proximaAcaoTexto (port do legado)', () => {
  it('resolvida sem avaliação pede a avaliação', () => {
    expect(proximaAcaoTexto({ status: 'Resolvida', avaliacao: null, prazo: null })).toBe('Avalie como foi a resolução, logo abaixo.');
  });
  it('resolvida e avaliada agradece', () => {
    expect(proximaAcaoTexto({ status: 'Resolvida', avaliacao: { nota: 5, comentario: '', data: '2026-01-01' }, prazo: null })).toBe('Nenhuma — obrigado por avaliar!');
  });
  it('com prazo informa a previsão no fuso local, e o atraso', () => {
    const base = { status: 'Em análise', avaliacao: null, prazo: '2026-03-10T15:00:00.000Z' };
    expect(proximaAcaoTexto(base)).toBe('Previsão de retorno até 10/03/2026.');
    expect(proximaAcaoTexto({ ...base, atrasada: true })).toBe('Previsão de retorno até 10/03/2026 (em atraso).');
  });
  it('sem prazo aguarda a análise', () => {
    expect(proximaAcaoTexto({ status: 'Recebida', avaliacao: null, prazo: null })).toBe('Aguardando análise da equipe responsável.');
  });
});

describe('pedidoPendente', () => {
  it('só considera o último pedido, e só se não foi atendido', () => {
    expect(pedidoPendente({ pedidosReabertura: [] })).toBeNull();
    expect(pedidoPendente({ pedidosReabertura: [{ motivo: 'a', data: 'x', atendido: true }] })).toBeNull();
    const p = { motivo: 'b', data: 'y', atendido: false };
    expect(pedidoPendente({ pedidosReabertura: [{ motivo: 'a', data: 'x', atendido: true }, p] })).toBe(p);
  });
});

describe('proximaAcaoAdminTexto', () => {
  const base = { status: 'Em análise', avaliacao: null, prazo: null, responsavel: null, setor: null, pedidosReabertura: [] };
  it('pedido de reabertura pendente vem primeiro', () => {
    expect(proximaAcaoAdminTexto({ ...base, status: 'Resolvida', pedidosReabertura: [{ motivo: 'x', data: '2026-10-01T12:00:00Z', atendido: false }] })).toMatch(/reabertura/);
  });
  it('recebida pede triagem; sem responsável pede definição; sem prazo pede prazo', () => {
    expect(proximaAcaoAdminTexto({ ...base, status: 'Recebida' })).toMatch(/triagem/);
    expect(proximaAcaoAdminTexto(base)).toMatch(/setor ou o responsável/);
    expect(proximaAcaoAdminTexto({ ...base, responsavel: 'João' })).toMatch(/prazo/);
  });
  it('atrasada e resolvida', () => {
    expect(proximaAcaoAdminTexto({ ...base, prazo: '2026-09-01T15:00:00.000Z', atrasada: true })).toMatch(/vencido/);
    expect(proximaAcaoAdminTexto({ ...base, status: 'Resolvida' })).toMatch(/avaliação/);
    expect(proximaAcaoAdminTexto({ ...base, status: 'Resolvida', avaliacao: { nota: 4, comentario: '', data: '' } })).toMatch(/4 de 5/);
  });
});
