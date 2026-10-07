// Lógica pura do medidor de senha (@ddoemonn no 21st.dev, recriado). NÃO bloqueia: o servidor só
// exige o mínimo de 6 caracteres; aqui só se orienta.

export const NIVEIS = ['Muito fraca', 'Fraca', 'Boa', 'Forte'] as const;

const SENHAS_COMUNS = ['123456', 'senha', 'password', 'qwerty', 'abc123', '111111', 'braco', 'urbana'];

export interface SenhaContexto { nome?: string; email?: string }
export interface Requisitos { tamanho: boolean; maiusculaMinuscula: boolean; numero: boolean; simbolo: boolean }
export interface Avaliacao {
  /** 0 = vazia; 1..4 = Muito fraca, Fraca, Boa, Forte (índice em NIVEIS + 1). */
  nivel: 0 | 1 | 2 | 3 | 4;
  rotulo: string | null;
  requisitos: Requisitos;
  avisos: string[];
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function requisitosDe(senha: string): Requisitos {
  return {
    tamanho: senha.length >= 8,
    maiusculaMinuscula: /[A-ZÀ-Ý]/.test(senha) && /[a-zà-ÿ]/.test(senha),
    numero: /\d/.test(senha),
    simbolo: /[^A-Za-z0-9À-ÿ\s]/.test(senha),
  };
}

/** Sequência crescente ou decrescente de 4+ caracteres seguidos (abcd, 1234, 4321). */
export function temSequencia(senha: string, minimo = 4): boolean {
  const s = semAcento(senha);
  let asc = 1;
  let desc = 1;
  for (let i = 1; i < s.length; i++) {
    const d = s.charCodeAt(i) - s.charCodeAt(i - 1);
    const alnum = /[a-z0-9]/.test(s[i] ?? '') && /[a-z0-9]/.test(s[i - 1] ?? '');
    asc = alnum && d === 1 ? asc + 1 : 1;
    desc = alnum && d === -1 ? desc + 1 : 1;
    if (asc >= minimo || desc >= minimo) return true;
  }
  return false;
}

/** Mesmo caractere 3+ vezes seguidas (aaa, 111). */
export function temRepeticao(senha: string): boolean {
  return /(.)\1\1/.test(senha);
}

export function contemSenhaComum(senha: string): boolean {
  const s = semAcento(senha);
  return SENHAS_COMUNS.some((c) => s.includes(c));
}

/** Contém o nome (qualquer parte com 3+ letras) ou o prefixo do e-mail (3+ letras). */
export function contemDadosPessoais(senha: string, ctx: SenhaContexto = {}): boolean {
  const s = semAcento(senha);
  const partes = semAcento(ctx.nome ?? '').split(/\s+/).filter((p) => p.length >= 3);
  const prefixo = semAcento((ctx.email ?? '').split('@')[0] ?? '');
  if (prefixo.length >= 3) partes.push(prefixo);
  return partes.some((p) => s.includes(p));
}

export function avaliarSenha(senha: string, ctx: SenhaContexto = {}): Avaliacao {
  const requisitos = requisitosDe(senha);
  if (!senha) return { nivel: 0, rotulo: null, requisitos, avisos: [] };

  const avisos: string[] = [];
  const comum = contemSenhaComum(senha);
  const sequencia = temSequencia(senha);
  const repeticao = temRepeticao(senha);
  const pessoal = contemDadosPessoais(senha, ctx);
  if (comum) avisos.push('Evite senhas comuns ou ligadas ao Urbana.');
  if (sequencia) avisos.push('Evite sequências como 1234 ou abcd.');
  if (repeticao) avisos.push('Evite repetir o mesmo caractere 3 vezes seguidas.');
  if (pessoal) avisos.push('Não use seu nome nem seu e-mail na senha.');

  const atendidos = Object.values(requisitos).filter(Boolean).length; // 0..4
  let nivel = Math.max(1, atendidos);
  if (comum) nivel = 1;
  else {
    const penalidades = [sequencia, repeticao, pessoal].filter(Boolean).length;
    nivel = Math.max(1, nivel - penalidades);
    // "Forte" exige os 4 requisitos e nenhum aviso
    if (nivel === 4 && avisos.length) nivel = 3;
  }
  const n = nivel as 1 | 2 | 3 | 4;
  return { nivel: n, rotulo: NIVEIS[n - 1] ?? null, requisitos, avisos };
}
