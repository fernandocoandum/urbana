# Urbana — Sistema de Ocorrências Urbanas

Aplicação web para que moradores de Braço do Norte (SC) relatem problemas de infraestrutura
urbana (buracos, iluminação, limpeza, sinalização, drenagem, etc.) e acompanhem o andamento de
cada ocorrência junto à Prefeitura, que gerencia o atendimento em um painel próprio.

Projeto acadêmico, construído com Node.js puro (módulo `http`, sem framework) no back-end e uma
única página HTML/CSS/JS no front-end (`public/index.html`), com persistência em PostgreSQL
(produção) ou em um arquivo `db.json` local (desenvolvimento).

## Como rodar localmente

```bash
npm install
npm start
```

O servidor sobe em `http://localhost:3000` (ou na porta definida em `PORT`). Sem a variável
`DATABASE_URL`, ele usa automaticamente o banco local `db.json` (criado na primeira execução) —
adequado para desenvolvimento, mas **não deve ser usado em produção**: em hospedagem serverless
(como a Vercel) o sistema de arquivos não é persistente entre execuções, e os dados seriam
perdidos.

Em modo de desenvolvimento (sem `DATABASE_URL`), uma conta administrativa de conveniência é
criada automaticamente:

- **E-mail:** `admin@prefeitura.gov.br`
- **Senha:** `admin`

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | Em produção | String de conexão do PostgreSQL. Se definida, o servidor **exige** que o banco esteja saudável — nunca cai silenciosamente para o `db.json` local. Se a conexão falhar, a API responde `503` até o banco voltar. |
| `PORT` | Não | Porta HTTP (padrão `3000`, ou a porta atribuída automaticamente pela plataforma de hospedagem). |
| `ADMIN_EMAIL` | Não | E-mail da conta administrativa criada/atualizada na inicialização (padrão `admin@prefeitura.gov.br`). |
| `ADMIN_SENHA` | Recomendado em produção | Senha da conta administrativa. Se definida, é sincronizada a cada inicialização (permite trocar a senha só reimplantando). **Se não for definida em produção**, uma senha aleatória é gerada e impressa **uma única vez** no log da inicialização — troque-a assim que possível. |
| `ADMIN_NOME` | Não | Nome de exibição da conta administrativa (padrão "Admin Prefeitura"). |
| `DEBUG_EXPOSE_RESET_TOKEN` | Não | Só para demonstração/estudo: expõe o token de redefinição de senha na resposta da API mesmo em produção (Postgres), já que o projeto não tem serviço de e-mail configurado. **Não defina isso em um ambiente real.** |

## Recuperação de senha (sem envio de e-mail)

O projeto não integra nenhum serviço de e-mail. Por isso, o fluxo de "esqueci minha senha"
(`POST /api/recuperar-senha` → `POST /api/redefinir-senha`) funciona assim:

- Em modo de desenvolvimento (`db.json`) ou com `DEBUG_EXPOSE_RESET_TOKEN=1`, o token de
  redefinição é devolvido diretamente na resposta da API (e exibido na tela), simulando o link
  que normalmente chegaria por e-mail.
- Em produção (Postgres) sem essa variável, o token **não é exposto** na resposta — fica apenas
  registrado no log do servidor. Isso evita que qualquer pessoa possa redefinir a senha de outra
  só sabendo o e-mail dela. Para um uso real, o próximo passo seria integrar um serviço de envio
  de e-mail transacional (SendGrid, Resend, SES, etc.) no lugar do `console.log`.

## Arquitetura

- **`server.js`** — servidor HTTP puro, todas as rotas da API (`/api/...`), autenticação por
  sessão (token em cookie/`Authorization: Bearer`), validações de entrada, rate limiting em
  memória, e a camada `db` que abstrai Postgres vs. JSON local por trás da mesma interface.
- **`public/index.html`** — front-end single-file (HTML + CSS + JS inline, sem build step),
  organizado em "views" (`<div class="view">`) alternadas via JavaScript, imitando um SPA simples.
- **PostgreSQL** — tabelas `users`, `ocorrencias`, `sessions`, `apoios_registro` (registro
  normalizado de apoios, evitando releitura/reescrita do array inteiro a cada apoio), `config`,
  `chat_mensagens`.

## Segurança implementada

- Senhas com hash `scrypt` salgado (compatibilidade retroativa com hashes antigos, migrados de
  forma transparente no primeiro login).
- Rate limiting por usuário/IP em rotas sensíveis (login, cadastro, criação de ocorrência, upload,
  mensagens, recuperação de senha).
- Validação de upload de imagem por **assinatura real do arquivo** (magic bytes), não apenas pelo
  `Content-Type` declarado.
- Aceite dos termos de uso verificado no servidor (não apenas no cliente).
- Cabeçalhos de segurança HTTP (CSP, X-Frame-Options, etc.) — a geocodificação (busca de endereço
  e localização reversa) é feita por um proxy no próprio servidor (`/api/geocode`), nunca
  diretamente do navegador para o Nominatim, para não violar a política de `connect-src 'self'`.
- Validação de coordenadas geográficas (rejeita latitude/longitude fora dos limites válidos).
- Sem fallback silencioso de Postgres para JSON em produção; a API responde `503` em vez de
  fingir sucesso quando o banco está indisponível.

## Débito técnico conhecido / escopo conscientemente adiado

Alguns pontos foram identificados e adiados deliberadamente, por não bloquearem o piloto:

- **Rate limiting em memória**: reseta a cada reinício do processo e não é compartilhado entre
  múltiplas instâncias (relevante só em hospedagem com mais de uma instância simultânea).
- **Sessão via `localStorage`** no cliente: simples e suficiente para o escopo atual; uma versão
  futura poderia migrar para cookies `httpOnly`.
- **Arquivos monolíticos**: `public/index.html` (front-end) e `server.js` (back-end) concentram
  toda a aplicação em um arquivo cada. Adequado para o tamanho atual do projeto; separar em
  módulos seria o próximo passo natural caso o projeto cresça.
- **Sem paginação** nas listagens (`/api/ocorrencias`, `/api/mapa`) — aceitável no volume atual de
  dados de um piloto municipal.
- **Sem suíte de testes automatizados formal nem CI** — a validação foi feita com scripts de
  regressão end-to-end via Playwright (não incluídos no pacote de produção; ver seção abaixo).

Por sugestão explícita da análise de produto que orientou esta rodada de melhorias, os itens
abaixo foram deixados de fora **de propósito**, por serem evoluções de estágio posterior:

- PWA / fila de envio offline.
- Suporte a múltiplos municípios/tenants.
- Sugestão automática de ocorrências semelhantes, rascunhos por usuário, exportação de KPIs
  operacionais.
- Gamificação, chatbot e classificação automática por IA.

## Testando manualmente

Fluxos principais a verificar após qualquer mudança:

1. Cadastro → login → aceite dos termos → nova ocorrência (com e sem localização/foto).
2. Painel do cidadão: histórico completo, conversa com a prefeitura, pedido de reabertura após
   resolução, avaliação.
3. Painel da prefeitura: mudança de status (retroceder exige justificativa), encaminhamento a
   setor, responsável/prazo, marcar como resolvida (exige evidência), conversa com o cidadão,
   badge de notificações não lidas.
4. Mapa da cidade (pontos com localização aproximada aparecem visualmente diferentes dos pontos
   com localização exata).
5. Recuperação de senha (fluxo completo, incluindo o link `?reset=TOKEN`).
