// Constantes do mapa (copiadas do app legado). Cores são constantes: os ícones do Leaflet são
// montados com nós DOM, nunca com HTML vindo de dados.
export const CENTRO_CIDADE: [number, number] = [-28.2761, -49.1712];

export const BAIRRO_CENTROS: Record<string, [number, number]> = {
  'Centro': [-28.2761, -49.1712],
  'Pinheiral': [-28.265, -49.158],
  'Baixo Pinheiral': [-28.27, -49.152],
  'São Maurício': [-28.29, -49.18],
  'Rio Glória': [-28.255, -49.19],
  'Santa Clara': [-28.282, -49.165],
  'Outro': [-28.2761, -49.1712],
};

export const MAPA_COR_STATUS: Record<string, string> = {
  'Recebida': '#94a3b8',
  'Em análise': '#f59e0b',
  'Encaminhada': '#8b5cf6',
  'Em atendimento': '#3b82f6',
  'Resolvida': '#22c55e',
};
export const COR_PIN_PADRAO = '#2563eb';

export function centroDoBairro(bairro: string | null | undefined): [number, number] {
  return (bairro && BAIRRO_CENTROS[bairro]) || CENTRO_CIDADE;
}
