import { Construction, Droplets, LayoutGrid, Lightbulb, Trash2, TrafficCone, Trees, type LucideIcon } from 'lucide-react';

/** Categorias (CATEGORIA_INFO do legado): cor via token CSS e ícone lucide. */
export interface CategoriaInfo { icon: LucideIcon; cssVar: string; curta: string }

export const CATEGORIA_INFO: Record<string, CategoriaInfo> = {
  'Pavimentação': { icon: Construction, cssVar: '--cat-pavimentacao', curta: 'Pavimentação' },
  'Iluminação pública': { icon: Lightbulb, cssVar: '--cat-iluminacao', curta: 'Iluminação' },
  'Limpeza urbana': { icon: Trash2, cssVar: '--cat-limpeza', curta: 'Limpeza' },
  'Sinalização': { icon: TrafficCone, cssVar: '--cat-sinalizacao', curta: 'Sinalização' },
  'Drenagem / Bueiro': { icon: Droplets, cssVar: '--cat-drenagem', curta: 'Drenagem' },
  'Parques e jardins': { icon: Trees, cssVar: '--cat-parques', curta: 'Parques' },
  'Outros': { icon: LayoutGrid, cssVar: '--cat-outros', curta: 'Outros' },
};
export const CATEGORIAS = Object.keys(CATEGORIA_INFO);
export function categoriaInfo(cat: string): CategoriaInfo {
  return CATEGORIA_INFO[cat] ?? CATEGORIA_INFO['Outros']!;
}

/** Status e suas cores (texto/ponto). O fundo soft é color-mix sobre a superfície. */
export const STATUS_LISTA = ['Recebida', 'Em análise', 'Encaminhada', 'Em atendimento', 'Resolvida'] as const;
export type StatusOcorrencia = (typeof STATUS_LISTA)[number];
export const STATUS_CSS_VAR: Record<StatusOcorrencia, string> = {
  'Recebida': '--st-recebida',
  'Em análise': '--st-analise',
  'Encaminhada': '--st-encaminhada',
  'Em atendimento': '--st-atendimento',
  'Resolvida': '--st-resolvida',
};
export function statusCssVar(status: string): string {
  return STATUS_CSS_VAR[status as StatusOcorrencia] ?? '--st-recebida';
}

export const BAIRROS = ['Centro', 'Pinheiral', 'Baixo Pinheiral', 'São Maurício', 'Rio Glória', 'Santa Clara', 'Outro'] as const;
