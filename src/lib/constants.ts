export const CATEGORIAS_VALIDAS = new Set<string>(['Pavimentação','Iluminação pública','Limpeza urbana','Sinalização','Drenagem / Bueiro','Parques e jardins','Outros']);
export const BAIRROS_VALIDOS = new Set<string>(['Centro','Pinheiral','Baixo Pinheiral','São Maurício','Rio Glória','Santa Clara','Outro']);
export const STATUS_VALIDOS = new Set<string>(['Recebida','Em análise','Encaminhada','Em atendimento','Resolvida']);
export const STATUS_ORDEM = ['Recebida','Em análise','Encaminhada','Em atendimento','Resolvida'] as const;
// Setores do encaminhamento (opções do select #det-setor do painel admin legado; a API não valida o campo).
export const SETORES = [
  'Secretaria de Obras',
  'Secretaria de Limpeza',
  'Iluminação Pública',
  'Trânsito e Mobilidade',
  'Parques e Jardins',
] as const;
export const ALLOWED_IMAGE_MIME = new Set<string>(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
export const SESSION_COOKIE = 'urbana_token';
