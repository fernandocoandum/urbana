import { describe, expect, it } from 'vitest';
import { ehRegressao, ERRO_EVIDENCIA, ERRO_PEDIDO, ERRO_REGRESSAO, validarMudancaStatus } from '@/features/admin/validar-status';

const base = { status: 'Em análise', pedidosReabertura: [], evidenciaResolucao: null };
const pedido = { motivo: 'voltou', data: '2026-10-01T12:00:00.000Z', atendido: false };

describe('ehRegressao', () => {
  it('só é regressão quando o novo status vem antes na ordem', () => {
    expect(ehRegressao('Resolvida', 'Em atendimento')).toBe(true);
    expect(ehRegressao('Em análise', 'Recebida')).toBe(true);
    expect(ehRegressao('Em análise', 'Encaminhada')).toBe(false);
    expect(ehRegressao('Em análise', 'Em análise')).toBe(false);
    expect(ehRegressao('Inexistente', 'Recebida')).toBe(false);
  });
});

describe('validarMudancaStatus', () => {
  it('avançar sem nada além do status é permitido', () => {
    expect(validarMudancaStatus({ atual: base, novo: 'Encaminhada' })).toEqual({ ok: true });
  });

  it('retroceder exige justificativa (espaços não contam)', () => {
    const atual = { ...base, status: 'Em atendimento' };
    expect(validarMudancaStatus({ atual, novo: 'Em análise', obs: '   ' })).toEqual({ ok: false, campo: 'obs', erro: ERRO_REGRESSAO });
    expect(validarMudancaStatus({ atual, novo: 'Em análise', obs: 'Faltou material' })).toEqual({ ok: true });
  });

  it('resolver exige evidência', () => {
    expect(validarMudancaStatus({ atual: base, novo: 'Resolvida', obs: 'ok' })).toEqual({ ok: false, campo: 'evidencia', erro: ERRO_EVIDENCIA });
    expect(validarMudancaStatus({ atual: base, novo: 'Resolvida', evidencia: '  ' })).toMatchObject({ ok: false, campo: 'evidencia' });
    expect(validarMudancaStatus({ atual: base, novo: 'Resolvida', evidencia: 'Foto anexada' })).toEqual({ ok: true });
  });

  it('já resolvida com evidência: reafirmar não pede evidência de novo', () => {
    const atual = { status: 'Resolvida', pedidosReabertura: [], evidenciaResolucao: 'Foto anexada' };
    expect(validarMudancaStatus({ atual, novo: 'Resolvida' })).toEqual({ ok: true });
  });

  it('resolver de novo depois de reaberta exige evidência nova', () => {
    const atual = { status: 'Em atendimento', pedidosReabertura: [], evidenciaResolucao: 'Evidência antiga' };
    expect(validarMudancaStatus({ atual, novo: 'Resolvida' })).toMatchObject({ ok: false, campo: 'evidencia' });
  });

  it('pedido de reabertura pendente exige justificativa ao resolver', () => {
    const atual = { status: 'Resolvida', pedidosReabertura: [pedido], evidenciaResolucao: 'Foto anexada' };
    expect(validarMudancaStatus({ atual, novo: 'Resolvida' })).toEqual({ ok: false, campo: 'obs', erro: ERRO_PEDIDO });
    expect(validarMudancaStatus({ atual, novo: 'Resolvida', obs: 'Revisamos, está correto' })).toEqual({ ok: true });
  });

  it('pedido já atendido não bloqueia', () => {
    const atual = { status: 'Resolvida', pedidosReabertura: [{ ...pedido, atendido: true }], evidenciaResolucao: 'x' };
    expect(validarMudancaStatus({ atual, novo: 'Resolvida' })).toEqual({ ok: true });
  });
});
