import { describe, expect, it } from 'vitest';
import { pedidoPendente, proximaAcaoTexto } from '@/features/ocorrencias/proxima-acao';

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
