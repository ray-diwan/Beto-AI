# Gráficos do simulador

O motor calcula os dados no n8n e retorna `resultado.visual.graficos`. O site desenha SVGs, legendas e tabelas; os resultados não são recalculados nem reescritos pela IA.

## Código

`motor-monte-carlo.js` contém o motor base. Acrescente `graficos-v3.js` imediatamente depois dele, antes do restante do código, nos nós **Roteador**, **Montar resposta IA** e **Executar simulação**. Não acrescente o módulo duas vezes. A lista de chaves permitidas em Executar simulação pode incluir `meses` e `taxaMensal` para extração por mensagem; os formulários já permitem informá-los.

## Gráficos

- Trajetórias originais e média dos cenários.
- Distribuição dos saldos finais com faixas comuns na comparação A/B.
- Percentual acumulado sem saldo para continuar.
- Mediana e faixa entre percentis 10 e 90 por rodada (uma faixa por valor de aposta).
- Apostar, guardar e aplicar o mesmo capital inicial, sem aportes ou retiradas.
- Convergência do resultado líquido médio por aposta, em sequência didática sem restrição de capital.
- Total movimentado, pagamentos e resultado líquido médio por cenário.
- Sequências iniciais de perdas versus chance da próxima vitória no modelo independente.
- Próxima aposta, capital necessário e orçamento ao dobrar após perdas.

## Hipóteses

O horizonte da comparação pode ser de 1 a 120 meses; as rodadas simuladas são distribuídas nesse período. A taxa mensal hipotética é configurável entre 0% e 5%, inicialmente 0%; não é uma taxa de mercado. A aplicação é nominal, sem impostos, taxas ou inflação. O saldo guardado não rende. Percentis descrevem os cenários, não intervalos de confiança nem garantias.

Mantêm-se os limites de até 5.000 rodadas, 100 a 5.000 cenários e 2 milhões de sorteios por valor de aposta. A comparação A/B usa a mesma sequência de sorteios. Os cenários param quando o saldo não cobre a próxima aposta e preservam o restante. Só agregados são enviados ao site; o contexto da conversa contém parâmetros, sem amostras de simulação.

## Verificação

Execute `node --test tests/*.test.mjs`. Os testes incluem conservação dos fluxos financeiros, risco acumulado, histogramas de massa 100%, comparação com sorteios iguais, percentis e casos extremos de probabilidade.
