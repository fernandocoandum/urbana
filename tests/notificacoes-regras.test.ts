import { describe, expect, it } from 'vitest';
import {
  devePularEmail,
  linkDaOcorrencia,
  notificacaoDeMensagem,
  notificacaoDeReaberturaAtendida,
  notificacaoDeStatus,
} from '@/features/notificacoes/regras';
import { escaparHtml, htmlEmailNotificacao } from '@/lib/mail';

const oc = { protocolo: 'PROT-2026-0007', status: 'Em análise', setor: null as string | null };

describe('notificacaoDeStatus', () => {
  it('muda o status: título com protocolo e status, texto com a observação', () => {
    const n = notificacaoDeStatus(oc, 'Em atendimento', 'Equipe a caminho.');
    expect(n).toEqual({ tipo: 'status', titulo: 'Sua ocorrência PROT-2026-0007 está Em atendimento', texto: 'Equipe a caminho.' });
  });
  it('sem observação usa um texto padrão do status', () => {
    expect(notificacaoDeStatus(oc, 'Resolvida', '')!.texto).toMatch(/resolvida/i);
    expect(notificacaoDeStatus(oc, 'Status Estranho', undefined)!.texto).toContain('Status Estranho');
  });
  it('devolve null quando o status não mudou e não há setor novo', () => {
    expect(notificacaoDeStatus(oc, 'Em análise', 'nota')).toBeNull();
    expect(notificacaoDeStatus({ ...oc, setor: 'Obras' }, 'Em análise', 'nota', 'Obras')).toBeNull();
    expect(notificacaoDeStatus(oc, 'Em análise', 'nota', '   ')).toBeNull();
  });
  it('mesmo status com setor novo notifica o encaminhamento', () => {
    const n = notificacaoDeStatus(oc, 'Em análise', 'Vai para a equipe.', 'Secretaria de Obras')!;
    expect(n.titulo).toBe('Sua ocorrência PROT-2026-0007 foi encaminhada para Secretaria de Obras');
    expect(n.texto).toBe('Vai para a equipe.');
  });
  it('status e setor juntos citam o setor no texto', () => {
    const n = notificacaoDeStatus(oc, 'Encaminhada', 'Segue.', 'Obras')!;
    expect(n.titulo).toContain('está Encaminhada');
    expect(n.texto).toBe('Segue. Setor responsável: Obras.');
  });
  it('limita observações longas', () => {
    expect(notificacaoDeStatus(oc, 'Resolvida', 'a'.repeat(1000))!.texto.length).toBeLessThanOrEqual(280);
  });
});

describe('notificacaoDeMensagem', () => {
  it('título fixo e trecho de até 140 caracteres', () => {
    const n = notificacaoDeMensagem(oc, 'Olá,\n  tudo bem?');
    expect(n.tipo).toBe('mensagem');
    expect(n.titulo).toBe('A prefeitura respondeu à sua ocorrência PROT-2026-0007');
    expect(n.texto).toBe('Olá, tudo bem?');
    const longa = notificacaoDeMensagem(oc, 'b'.repeat(500)).texto;
    expect(longa).toHaveLength(140);
    expect(longa.endsWith('…')).toBe(true);
  });
});

describe('notificacaoDeReaberturaAtendida', () => {
  it('status mudou: foi atendido', () => {
    const n = notificacaoDeReaberturaAtendida({ ...oc, status: 'Resolvida' }, 'Em atendimento');
    expect(n.tipo).toBe('reabertura');
    expect(n.titulo).toContain('foi atendido');
    expect(n.texto).toContain('Em atendimento');
  });
  it('continua resolvida: foi analisado, com a justificativa', () => {
    const n = notificacaoDeReaberturaAtendida({ ...oc, status: 'Resolvida' }, 'Resolvida', 'Está correto.');
    expect(n.titulo).toContain('foi analisado');
    expect(n.texto).toBe('Está correto.');
  });
});

describe('devePularEmail e linkDaOcorrencia', () => {
  it('só desliga com valores explícitos de "não"', () => {
    expect(devePularEmail({})).toBe(false);
    expect(devePularEmail({ NOTIFICACOES_EMAIL: '1' })).toBe(false);
    for (const v of ['0', 'false', 'OFF', ' 0 ']) expect(devePularEmail({ NOTIFICACOES_EMAIL: v })).toBe(true);
  });
  it('monta o link com PUBLIC_ORIGIN, depois VERCEL_URL, e omite sem origem', () => {
    expect(linkDaOcorrencia({ PUBLIC_ORIGIN: 'https://a.gov.br/' }, 'oc1')).toBe('https://a.gov.br/ocorrencias/oc1');
    expect(linkDaOcorrencia({ VERCEL_URL: 'urbana.vercel.app' }, 'oc1')).toBe('https://urbana.vercel.app/ocorrencias/oc1');
    expect(linkDaOcorrencia({ PUBLIC_ORIGIN: 'https://a.gov.br', VERCEL_URL: 'x.vercel.app' }, 'oc1')).toBe('https://a.gov.br/ocorrencias/oc1');
    expect(linkDaOcorrencia({}, 'oc1')).toBeNull();
  });
});

describe('htmlEmailNotificacao', () => {
  it('escapa HTML no título, no texto e no link', () => {
    const html = htmlEmailNotificacao('<img src=x onerror=alert(1)>', 'a & b <script>x</script>\n"aspas"', 'https://a.gov.br/?q="><b>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('"><b>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('a &amp; b &lt;script&gt;x&lt;/script&gt;<br>&quot;aspas&quot;');
  });
  it('omite o botão sem link', () => {
    expect(htmlEmailNotificacao('t', 'x', null)).not.toContain('<a ');
    expect(htmlEmailNotificacao('t', 'x', 'https://a.gov.br/ocorrencias/oc1')).toContain('href="https://a.gov.br/ocorrencias/oc1"');
  });
  it('escaparHtml cobre os cinco caracteres', () => {
    expect(escaparHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });
});
