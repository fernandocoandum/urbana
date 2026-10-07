'use client';

// Gráficos da visão geral (recharts). Segue a skill dataviz: marcas finas (linha 2px, barra até 24px com
// ponta de 4px), grade recessiva, legenda para 2+ séries, tooltip com valor em destaque, visão em tabela,
// cores só por tokens (--viz-1/--viz-2, validados nos dois temas). Rótulos e eixos usam tokens de texto.
import { useReducedMotion } from 'motion/react';
import { useId, type ReactNode } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PontoSerie } from '../fila';

const EIXO = { fill: 'var(--fg-muted)', fontSize: 14 } as const;

interface TooltipLinha { chave: string; rotulo: string; valor: number; cor?: string }

function CaixaTooltip({ titulo, linhas }: { titulo: string; linhas: TooltipLinha[] }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-3 shadow-md">
      <p className="text-sm text-fg-muted">{titulo}</p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {linhas.map((l) => (
          <li key={l.chave} className="flex items-center gap-2">
            {l.cor && <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ backgroundColor: l.cor }} />}
            <span className="tabular text-base font-semibold text-fg">{l.valor}</span>
            <span className="text-sm text-fg-muted">{l.rotulo}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TabelaDados({ legenda, colunas, linhas }: { legenda: string; colunas: string[]; linhas: (string | number)[][] }) {
  return (
    <details className="group mt-4">
      <summary className="inline-flex min-h-9 cursor-pointer select-none items-center rounded-md text-sm font-medium text-primary outline-none focus-visible:ring-4 focus-visible:ring-primary/25">
        Ver dados em tabela
      </summary>
      <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{legenda}</caption>
          <thead className="sticky top-0 bg-surface-2 text-fg-muted">
            <tr>{colunas.map((c) => <th key={c} scope="col" className="px-4 py-3 font-medium">{c}</th>)}</tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i} className="border-t border-border">
                {l.map((v, j) => <td key={j} className={j === 0 ? 'px-4 py-3' : 'tabular px-4 py-3'}>{v}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function Legenda({ itens }: { itens: { rotulo: string; cor: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Legenda">
      {itens.map((i) => (
        <li key={i.rotulo} className="flex items-center gap-2 text-sm text-fg-muted">
          <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ backgroundColor: i.cor }} />
          {i.rotulo}
        </li>
      ))}
    </ul>
  );
}

/** Área: criadas × resolvidas por dia (2 séries, mesma escala). */
export function GraficoSerie({ serie }: { serie: PontoSerie[] }) {
  const reduzido = useReducedMotion();
  const id = useId().replace(/:/g, '');
  const totalCriadas = serie.reduce((s, p) => s + p.criadas, 0);
  const totalResolvidas = serie.reduce((s, p) => s + p.resolvidas, 0);
  return (
    <div>
      <Legenda
        itens={[
          { rotulo: `Criadas (${totalCriadas})`, cor: 'var(--viz-1)' },
          { rotulo: `Resolvidas (${totalResolvidas})`, cor: 'var(--viz-2)' },
        ]}
      />
      <div role="img" aria-label={`Ocorrências criadas e resolvidas por dia nos últimos 30 dias: ${totalCriadas} criadas e ${totalResolvidas} resolvidas.`} className="mt-4 h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={serie} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`${id}-a`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--viz-1)" stopOpacity={0.14} />
                <stop offset="100%" stopColor="var(--viz-1)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id={`${id}-b`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--viz-2)" stopOpacity={0.14} />
                <stop offset="100%" stopColor="var(--viz-2)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" strokeWidth={1} />
            <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tick={EIXO} interval="preserveStartEnd" minTickGap={28} tickMargin={8} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={EIXO} width={32} />
            <Tooltip
              cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <CaixaTooltip
                    titulo={String(label)}
                    linhas={[
                      { chave: 'c', rotulo: 'criadas', valor: Number(payload.find((p) => p.dataKey === 'criadas')?.value ?? 0), cor: 'var(--viz-1)' },
                      { chave: 'r', rotulo: 'resolvidas', valor: Number(payload.find((p) => p.dataKey === 'resolvidas')?.value ?? 0), cor: 'var(--viz-2)' },
                    ]}
                  />
                ) : null
              }
            />
            <Area type="monotone" dataKey="criadas" name="Criadas" stroke="var(--viz-1)" strokeWidth={2} fill={`url(#${id}-a)`} isAnimationActive={!reduzido} dot={false} activeDot={{ r: 5, fill: 'var(--viz-1)', stroke: 'var(--surface)', strokeWidth: 2 }} />
            <Area type="monotone" dataKey="resolvidas" name="Resolvidas" stroke="var(--viz-2)" strokeWidth={2} fill={`url(#${id}-b)`} isAnimationActive={!reduzido} dot={false} activeDot={{ r: 5, fill: 'var(--viz-2)', stroke: 'var(--surface)', strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <TabelaDados legenda="Ocorrências criadas e resolvidas por dia" colunas={['Dia', 'Criadas', 'Resolvidas']} linhas={serie.filter((p) => p.criadas || p.resolvidas).map((p) => [p.rotulo, p.criadas, p.resolvidas])} />
    </div>
  );
}

export interface ItemBarra { nome: string; total: number }

/**
 * Barras horizontais de uma série só (uma cor): o nome fica no eixo (rótulo direto) e o valor na ponta da
 * barra. Categoria não vira cor aqui: as cores de categoria do app não passam na validação da dataviz
 * (pavimentação e iluminação são quase iguais), e o nome já identifica cada barra.
 */
export function GraficoBarras({ itens, unidade, legenda, children }: { itens: ItemBarra[]; unidade: string; legenda: string; children?: ReactNode }) {
  const reduzido = useReducedMotion();
  const altura = Math.max(120, itens.length * 44 + 8);
  return (
    <div>
      <div role="img" aria-label={`${legenda}: ${itens.map((i) => `${i.nome} ${i.total}`).join(', ')}`} className="w-full" style={{ height: altura }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={itens} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }} barCategoryGap={10}>
            <XAxis type="number" hide domain={[0, 'dataMax']} allowDecimals={false} />
            <YAxis type="category" dataKey="nome" width={112} tickLine={false} axisLine={false} tick={EIXO} interval={0} />
            <Tooltip
              cursor={{ fill: 'var(--surface-2)' }}
              content={({ active, payload }) => {
                const item = payload?.[0]?.payload as ItemBarra | undefined;
                return active && item ? <CaixaTooltip titulo={item.nome} linhas={[{ chave: 't', rotulo: unidade, valor: item.total, cor: 'var(--viz-1)' }]} /> : null;
              }}
            />
            <Bar dataKey="total" fill="var(--viz-1)" barSize={20} radius={[0, 4, 4, 0]} isAnimationActive={!reduzido} activeBar={{ fill: 'var(--viz-1)', fillOpacity: 0.8 }}>
              <LabelList dataKey="total" position="right" offset={8} style={{ fill: 'var(--fg)', fontSize: 14, fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {children}
      <TabelaDados legenda={legenda} colunas={['Nome', 'Ocorrências']} linhas={itens.map((i) => [i.nome, i.total])} />
    </div>
  );
}
