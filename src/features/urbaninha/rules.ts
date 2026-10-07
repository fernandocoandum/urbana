// Urbaninha: assistente de suporte "fake". Um mapeamento de palavras-chave para respostas prontas,
// só no front-end — NÃO há IA real por trás. Regras, fallback e sugestões copiados do app legado.
export interface RegraUrbaninha { padrao: RegExp; respostas: string[] }

export const URBANINHA_REGRAS: RegraUrbaninha[] = [
  { padrao: /(oi|ol[áa]|bom dia|boa tarde|boa noite|hey|eae|e a[ií])/i,
    respostas: ['Oi! 👋 Eu sou a Urbaninha, assistente de suporte por aqui. Posso ajudar com dúvidas sobre como registrar uma ocorrência, acompanhar o status, recuperar sua senha e mais. O que você precisa?'] },
  { padrao: /(registr|abrir|cria[r]?|nova ocorr[êe]ncia|reportar|denunciar)/i,
    respostas: ['Para registrar uma ocorrência: faça login, clique em "Nova Ocorrência", escolha a categoria (iluminação, buraco na via, etc.), informe o endereço e, se quiser, anexe fotos. Depois é só acompanhar o andamento em "Minhas Ocorrências"! 📍'] },
  { padrao: /(senha|esque[cç]i|recuper|login|entrar|acesso)/i,
    respostas: ['Esqueceu sua senha? Na tela de login, clique em "Esqueceu sua senha?" e informe seu e-mail — você vai receber um link para criar uma nova senha. Se não chegar em alguns minutos, dá uma olhada na caixa de spam! 📧'] },
  { padrao: /(status|andamento|prazo|quanto tempo|situa[çc][ãa]o|demora)/i,
    respostas: ['Dá para acompanhar o status de cada ocorrência (Recebida, Em análise, Encaminhada, Em atendimento ou Resolvida) em "Minhas Ocorrências" — lá aparece o histórico completo e, quando informado, o prazo estimado da equipe responsável. ⏳'] },
  { padrao: /(reabr|resolveu errado|n[ãa]o foi resolvid|voltou o problema|de novo)/i,
    respostas: ['Se um problema marcado como "resolvido" voltar a acontecer, abra a ocorrência e use a opção de pedir reabertura, explicando o que ainda está errado. A equipe é notificada automaticamente. 🔁'] },
  { padrao: /(foto|imagem|anexo|upload)/i,
    respostas: ['Dá para anexar fotos (JPEG, PNG, WEBP ou GIF, até 8MB) ao registrar ou responder uma ocorrência — isso ajuda bastante a equipe a entender o problema! 📷'] },
  { padrao: /(mensage|responder|conversa|contato|falar com|prefeitura)/i,
    respostas: ['Dentro de cada ocorrência tem um espaço de mensagens para conversar diretamente com a prefeitura sobre aquele caso específico. É só abrir a ocorrência e escrever por lá. 💬'] },
  { padrao: /(obrigad|valeu|show|ajudou|de nada|beleza)/i,
    respostas: ['Disponha! 😊 Qualquer outra dúvida, é só chamar.'] },
  { padrao: /(humano|pessoa de verdade|atendente real|voc[êe] [ée] rob[oô]|bot mesmo|inteligencia artificial|intelig[êe]ncia artificial)/i,
    respostas: ['Hehe, confesso: sou só uma assistente de respostas prontas — nada de inteligência artificial de verdade por trás! Para falar com alguém da equipe, use o espaço de mensagens dentro da ocorrência. 🤖'] },
];

export const URBANINHA_FALLBACK = ['Hmm, ainda não tenho uma resposta pronta pra isso 😅 Tenta perguntar sobre: registrar ocorrência, status, senha, fotos ou mensagens.'];
export const URBANINHA_SUGESTOES = ['Como registro uma ocorrência?', 'Esqueci minha senha', 'Como vejo o status?', 'Posso anexar fotos?'];
export const URBANINHA_BOAS_VINDAS = 'Oi! 👋 Eu sou a Urbaninha, assistente de suporte do Urbana. Escolhe um tópico abaixo ou digita sua pergunta que eu tento ajudar!';

/** Primeira regra que casa com o texto (a ordem importa); `random` é injetável para os testes. */
export function responderUrbaninha(texto: string, random: () => number = Math.random): string {
  const regra = URBANINHA_REGRAS.find((r) => r.padrao.test(texto));
  const opcoes = regra ? regra.respostas : URBANINHA_FALLBACK;
  return opcoes[Math.floor(random() * opcoes.length)] ?? URBANINHA_FALLBACK[0]!;
}
