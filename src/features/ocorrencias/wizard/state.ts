// Estado e regras puras do wizard "Nova ocorrência" (port das regras do app legado: WZ_TITLES,
// wizardValidateStep e o corpo de enviarOcorrencia).

export type Passo = 1 | 2 | 3 | 4;
export const TOTAL_PASSOS = 4;
export type Precisao = '' | 'gps' | 'manual';

export const WZ_TITLES: Record<Passo, [string, string]> = {
  1: ['O que você quer relatar?', 'Escolha a categoria que melhor descreve o problema'],
  2: ['Onde fica o problema?', 'Informe o bairro e o endereço mais próximo'],
  3: ['Conte os detalhes', 'Um título claro e, se puder, uma foto ajudam muito'],
  4: ['Revise antes de enviar', 'Confira as informações — dá pra editar qualquer parte'],
};

export interface WizardState {
  step: Passo;
  /** 1 = avançando, -1 = voltando (direção da animação). */
  dir: 1 | -1;
  /** Veio do "Editar" da revisão: ao concluir o passo, volta direto para a revisão. */
  retorno: boolean;
  categoria: string;
  bairro: string;
  endereco: string;
  referencia: string;
  lat: number | null;
  lng: number | null;
  precisao: Precisao;
  titulo: string;
  descricao: string;
  foto: File | null;
  /** URL local (object URL) da prévia da foto. */
  fotoUrl: string | null;
  /** Já tentou avançar com campos faltando: mostra os campos inválidos. */
  tentou: boolean;
}

export const estadoInicial: WizardState = {
  step: 1, dir: 1, retorno: false,
  categoria: '', bairro: '', endereco: '', referencia: '',
  lat: null, lng: null, precisao: '',
  titulo: '', descricao: '', foto: null, fotoUrl: null, tentou: false,
};

type CampoTexto = 'categoria' | 'bairro' | 'endereco' | 'referencia' | 'titulo' | 'descricao';

export type Acao =
  | { type: 'campo'; campo: CampoTexto; valor: string }
  | { type: 'local'; lat: number; lng: number; precisao: 'gps' | 'manual' }
  | { type: 'foto'; foto: File | null; fotoUrl: string | null }
  | { type: 'ir'; step: Passo; retorno?: boolean }
  | { type: 'tentou' };

export function reducer(s: WizardState, a: Acao): WizardState {
  switch (a.type) {
    case 'campo':
      return { ...s, [a.campo]: a.valor };
    case 'local':
      return { ...s, lat: a.lat, lng: a.lng, precisao: a.precisao };
    case 'foto':
      return { ...s, foto: a.foto, fotoUrl: a.fotoUrl };
    case 'ir':
      return { ...s, step: a.step, dir: a.step >= s.step ? 1 : -1, retorno: a.step === 4 ? false : (a.retorno ?? s.retorno), tentou: false };
    case 'tentou':
      return { ...s, tentou: true };
  }
}

/** Mensagem do primeiro problema do passo (as mesmas do legado) ou null se está tudo certo. */
export function validarPasso(step: Passo, s: Pick<WizardState, 'categoria' | 'bairro' | 'endereco' | 'titulo'>): string | null {
  if (step === 1 && !s.categoria) return 'Escolha uma categoria para continuar.';
  if (step === 2 && (!s.bairro || !s.endereco.trim())) return 'Preencha bairro e endereço.';
  if (step === 3 && !s.titulo.trim()) return 'Dê um título curto para a ocorrência.';
  return null;
}

export const ERRO_CAMPOS_OBRIGATORIOS = 'Preencha os campos obrigatórios: Título, Categoria, Bairro e Endereço.';

export function camposObrigatoriosOk(s: Pick<WizardState, 'categoria' | 'bairro' | 'endereco' | 'titulo'>): boolean {
  return !!(s.titulo.trim() && s.categoria && s.bairro && s.endereco.trim());
}

/** Passo seguinte: a revisão, se veio do "Editar"; senão o próximo da fila. */
export function proximoPasso(s: Pick<WizardState, 'step' | 'retorno'>): Passo {
  if (s.retorno) return 4;
  return Math.min(TOTAL_PASSOS, s.step + 1) as Passo;
}

/** Corpo do POST /api/ocorrencias. Sem coordenadas, lat/lng/precisao ficam de fora. */
export function montarPayload(s: WizardState, foto: string | null) {
  return {
    titulo: s.titulo.trim(),
    descricao: s.descricao.trim(),
    categoria: s.categoria,
    bairro: s.bairro,
    endereco: s.endereco.trim(),
    referencia: s.referencia.trim(),
    foto,
    lat: s.lat ?? undefined,
    lng: s.lng ?? undefined,
    precisao: s.precisao || undefined,
  };
}
