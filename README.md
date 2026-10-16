# Beto AI

Interface de chat educativa do grupo E4, Projeto III. Site estático com rota de servidor compatível com Vercel, sem dependências de build. Nome proposto do repositório: **Beto-AI**. Na Vercel use **beto-ai** (nome normalizado em minúsculas); a disponibilidade do domínio só é confirmada na criação do projeto.

## Rodar

Node.js 22 ou superior: `node scripts/dev.mjs`. Abra http://127.0.0.1:3000. Use “Experimentar simulação” para testar o gráfico local, explicitamente identificado como demonstração. `node --test tests/*.test.mjs` executa as verificações.

## Conectar ao n8n

Na Vercel, configure as variáveis de ambiente **de servidor**:

- `N8N_WEBHOOK_URL`: endpoint HTTPS de produção do seu n8n.
- `N8N_WEBHOOK_TOKEN`: opcional; enviado em `Authorization: Bearer ...`. Configure autenticação de cabeçalho correspondente no Webhook do n8n.

Faça novo deploy depois de alterar variáveis. Para desenvolvimento local: `node --env-file=.env scripts/dev.mjs`.

A rota `/api/chat` envia `{ chatInput, sessionId, action: "sendMessage" }`. Use `sessionId` como chave da memória do agente e `chatInput` como mensagem. No n8n: **Webhook POST → AI Agent → montagem da resposta → Respond to Webhook**, com resposta JSON e sem streaming nesta versão. A resposta deve retornar na mesma requisição (timeout de 50 segundos no proxy).

O resultado do Code Tool não aparece automaticamente na saída final do AI Agent. Configure o workflow para preservar os campos calculados e entregá-los ao Respond to Webhook. Uma opção é habilitar os passos intermediários do agente e extrair a observação da chamada do simulador em um Code após o agente; escolha a chamada correta, valide o JSON e combine os dados com o texto final. O nome exato dos campos depende da versão do n8n. Não peça ao modelo para reescrever milhares de pontos: preserve os dados originais da ferramenta. Envie apenas o resumo necessário ao modelo.

Formato preferido:

```json
{"mensagem":"Sua explicação", "grafico":{"type":"line","data":{"labels":[0,1,2],"datasets":[{"label":"Sim 1","data":[1000,950,997.5],"borderColor":"#3498db"}]}}, "saldo_final_medio":997.5,"valor_esperado_por_aposta_pct":-2.5}
```

Compatibilidade com o exemplo original: `{ "grafico_url": "https://quickchart.io/chart?...", "saldo_final_medio": 1000, "valor_esperado_por_aposta_pct": -2.5 }`. Se a URL contiver configuração JSON em `c`, o site extrai os dados e desenha o gráfico interativo localmente. Para outras URLs HTTPS, exibe a imagem. Também aceita JSON como string em `output`, array de um item e envelopes `json`. URLs mencionadas apenas em texto livre não são convertidas automaticamente.

O gráfico local usa SVG, com consulta por cursor e tabela acessível. Não executa scripts, callbacks nem HTML retornados pelo modelo. A conversa fica somente em memória na aba; o n8n pode persistir a memória se configurado.

## Simulador

`n8n/simulador-code-tool.js` contém a versão corrigida do exemplo: valida parâmetros e preserva o saldo quando ele não permite outra aposta. De 1 a 8 trajetórias ilustrativas, até 5.000 rodadas; não é estimativa robusta de risco. Retorna `grafico` diretamente para evitar URLs extensas. Compare investimentos apenas com mesmo capital/aportes e horizonte explicitamente definidos.

## GitHub e Vercel

Crie o repositório **Beto-AI**, envie estes arquivos e importe-o na Vercel como **beto-ai**. Framework preset: Other; sem comando de build; diretório de saída: raiz. Não publique `.env` nem exportações n8n com segredos. O JSON de workflow pode ser versionado após revisão, mas exige n8n para executar; esta aplicação não é um runtime de workflows.

Antes de liberar para muitos usuários, configure proteção contra abuso e limites na entrada, além das cotas do n8n e do provedor de IA. A aplicação não inclui login ou armazenamento de histórico no navegador.
