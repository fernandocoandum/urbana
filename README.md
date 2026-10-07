# Urbana

Sistema de ocorrências urbanas da Prefeitura de Braço do Norte/SC. O cidadão registra problemas na cidade (buraco, lâmpada queimada, lixo, sinalização, drenagem), acompanha o andamento e conversa com a prefeitura. A equipe da prefeitura recebe, prioriza, encaminha e resolve pelo painel administrativo.

## O que tem

**Cidadão**
- Cadastro, login (e-mail e senha ou Google) e recuperação de senha.
- Registro de ocorrência em etapas, com foto e localização (GPS ou endereço).
- Acompanhamento com linha do tempo, conversa com a prefeitura, apoio a ocorrências de outros moradores, avaliação do atendimento e pedido de reabertura.
- Notificações: o sino mostra quando o status muda, quando a prefeitura responde ou quando um pedido de reabertura é atendido. Se houver e-mail configurado, o aviso também vai por e-mail.
- Mapa da cidade com agrupamento, mapa de calor e filtros por categoria e status.
- Urbaninha, a assistente de conversa.

**Prefeitura (admin)**
- Visão geral com indicadores e gráficos (criadas x resolvidas, por categoria e por bairro).
- Fila de atendimento com busca, filtros, ordenação por criticidade e filtros guardados na URL.
- Gestão da ocorrência: status (com justificativa ao retroceder), setor, responsável, prazo, evidência obrigatória ao resolver e conversa com o cidadão.
- Mapa com filtro "Só atrasadas".

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, motion, Radix UI, SWR, zod, Recharts, Leaflet (com markercluster e heat), Sonner. Banco PostgreSQL em produção e arquivo JSON local para desenvolvimento e testes.

> Esta versão do Next.js tem mudanças incompatíveis com versões anteriores. A documentação que acompanha o pacote fica em `node_modules/next/dist/docs/`; consulte-a antes de usar APIs do framework (veja também o `AGENTS.md`).

## Como rodar

Requer Node 20.9 ou mais novo.

```bash
npm ci
npm run dev
```

Abra http://localhost:3000. Sem `DATABASE_URL`, o app usa o banco JSON local (`db.json` na raiz, ignorado pelo git) e cria a conta de administração local:

| E-mail | Senha |
| --- | --- |
| `admin@prefeitura.gov.br` | `admin` |

Essa senha fixa existe só no modo JSON. Com `DATABASE_URL` definida, a senha é a de `ADMIN_SENHA` (ou uma temporária gerada e mostrada no log do servidor).

## Variáveis de ambiente

| Variável | Para que serve |
| --- | --- |
| `DATABASE_URL` | Conexão PostgreSQL. Presente = modo produção: se o banco cair, a API responde 503 em vez de usar o JSON local. |
| `ADMIN_EMAIL`, `ADMIN_NOME`, `ADMIN_SENHA` | Conta de administração criada ou sincronizada na inicialização (padrão `admin@prefeitura.gov.br`). |
| `GOOGLE_CLIENT_ID` | Habilita o login com Google. |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | E-mail via Gmail (senha de app). Tem prioridade sobre o Resend. |
| `RESEND_API_KEY`, `RESEND_FROM` | E-mail via Resend. |
| `PUBLIC_ORIGIN` | Endereço público do app (ex.: `https://urbana.exemplo.gov.br`), usado nos links dos e-mails e na restrição de origem. Na Vercel, cai para `VERCEL_URL`. |
| `NOTIFICACOES_EMAIL` | `0` desliga o e-mail das notificações (o sino continua funcionando). |
| `URBANA_DB_FILE` | Caminho do arquivo do banco JSON (usado para isolar testes). |
| `URBANA_DEV_UI` | `1` libera a vitrine `/dev/ui` em build de produção local. Na Vercel em produção ela é sempre 404. |
| `DEBUG_EXPOSE_RESET_TOKEN` | Só para demonstração: mostra o token de recuperação de senha quando não há e-mail configurado. Não use em produção. |

Sem Gmail nem Resend, as notificações continuam sendo gravadas e aparecem no sino; apenas o e-mail não é enviado.

## Testes e verificação

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # testes unitários e de API (Vitest)
npm run build       # build de produção
npx playwright test # E2E (sobe o próprio next start na porta 3099 com banco isolado em .tmp/)
```

`npm run test:e2e` faz o build antes de rodar o Playwright. Os E2E não precisam de Postgres.

## Deploy na Vercel

O deploy é automático a cada push no `main`. O `vercel.json` já define `framework: nextjs`, `npm ci` e `next build`.

- Em produção, `DATABASE_URL` é obrigatória: sem ela a API responde 503 (o disco da Vercel não é persistente, então o modo JSON não é aceito).
- Defina `ADMIN_SENHA`, `PUBLIC_ORIGIN` e, se quiser e-mail, `GMAIL_*` ou `RESEND_*`.
- O schema do banco é aditivo: tabelas são criadas com `CREATE TABLE IF NOT EXISTS` na inicialização, sem `ALTER` nem `DROP` em tabelas existentes, então é seguro apontar para um banco que já tem dados.

## Estrutura

```
src/app/           rotas (páginas e API)
src/features/      regras e telas por assunto (ocorrencias, admin, mapa, notificacoes, chat, auth...)
src/components/    UI compartilhada (shells, tabs, popover, sheet...)
src/lib/           banco (JSON e PostgreSQL), e-mail, formatação, movimento
tests/             Vitest e E2E (Playwright)
legacy/            versão original (servidor Node e HTML único), mantida só como referência
```

Observação: a fila do admin busca as ocorrências uma vez e filtra e ordena no navegador, o que atende bem algumas centenas de itens. Acima disso, vale mover os filtros para o servidor.
