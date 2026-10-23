# Beto AI

Chat educativo do grupo E4, Projeto III. O site roda na Vercel e usa o workflow n8n para conteúdo, sugestões e cálculos. Sem dependências de build.

## Colocar em funcionamento

1. Na [configuração da Vercel](https://vercel.com/beto-ia/beto-ai/settings/environment-variables), adicione a variável **de servidor** `N8N_WEBHOOK_URL` com o valor `https://grupoe4.app.n8n.cloud/webhook/bets-assistente`. Marque **Production** e **Preview** se quiser testar a prévia do GitHub.
2. Se o webhook usar Header Auth, configure o cabeçalho `Authorization` com `Bearer SEU_TOKEN` no n8n e o mesmo token em `N8N_WEBHOOK_TOKEN` na Vercel. Sem autenticação, deixe a variável ausente. Nunca coloque credenciais no código ou no chat.
3. Integre a alteração na branch principal e aguarde o deploy. Se configurar variáveis depois do deploy, faça **Redeploy**; elas só passam a valer em novas publicações.
4. Abra https://beto-ai.vercel.app/ e clique em **Explorar temas**. Escolha um tema, envie uma pergunta e use uma sugestão abaixo da resposta. Em **Simulação**, abra uma calculadora, preencha os valores e confirme o resultado.
5. Para as novas simulações de banca e comparação, publique no n8n o workflow `Assistente de bets - simulacoes v2.json` entregue separadamente. Confira as credenciais e a tabela de secções. Não publique duas versões no mesmo caminho. O workflow `Pagina do Beto` só é necessário para a página hospedada pelo próprio n8n; o site Vercel não depende dele.

Verificação em 23/10/2026: o webhook respondeu HTTP 200 ao menu inicial, com texto, temas e contexto. O site publicado respondeu HTTP 503 com `N8N_NOT_CONFIGURED`. Isso indica ausência da variável no deploy consultado. Essa verificação não confirma que a versão v2 esteja publicada nem que todas as credenciais de IA estejam válidas.

## Como funciona

O navegador chama `/api/chat`, que valida o pedido e encaminha JSON ao webhook. URL e token ficam no servidor. O protocolo segue os JSONs do projeto:

```json
{"acao":"mensagem","texto":"Como funcionam as odds?","sessionId":"sessao-12345","contexto":{"secaoAtual":"bets"}}
```

As outras ações são `secao` (com `secao`), `form` e `calc` (com `tipo` e `dados`). `contexto` retorna do n8n e acompanha a próxima interação. Mensagens têm limite de 500 caracteres, conforme o roteador. Os campos legados `chatInput` e `action: sendMessage` também são enviados nas mensagens.

A resposta aceita `texto`, `acoes`, `acoesTitulo`, `botoes`, `formulario`, `contexto` e `resultado.visual.grafico`. As sugestões são as próximas ações escolhidas pelo workflow. Formulários enviam os dados para cálculo no n8n. O gráfico v2 é desenhado localmente, com consulta por cursor e tabela. Outros resultados numéricos aparecem em cartões.

Respostas antigas com `output`, `mensagem`, `grafico`, `grafico_url`, envelopes `resposta`/`json` e arrays de um item continuam aceitas. O texto suporta negrito sem interpretar HTML ou scripts. Opções de respostas anteriores ficam desabilitadas após uma nova resposta; em caso de falha, é possível tentar novamente. Conversa e contexto ficam na memória da aba; **Nova conversa** os reinicia. **Experimentar simulação** usa dados locais explicitamente identificados como demonstração.

O webhook deve responder JSON na mesma requisição usando **Respond to Webhook**, como no fluxo fornecido. Timeout: 50 segundos. Consulte a [documentação do n8n](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/) e a [documentação de variáveis da Vercel](https://vercel.com/docs/environment-variables).

## Desenvolvimento e testes

Node.js 22 ou superior. Copie `.env.example` para `.env`, ajuste se necessário e execute `node --env-file=.env scripts/dev.mjs`. Abra http://127.0.0.1:3000. Execute `npm test` para verificar ações, contexto, sugestões, formulários, gráficos, respostas antigas e erros do proxy.

Na Vercel: framework **Other**, sem build, raiz como diretório do projeto. Não publique `.env` nem exportações com segredos. As calculadoras existentes do n8n não tiveram suas hipóteses ou regras tributárias revisadas nesta integração.
