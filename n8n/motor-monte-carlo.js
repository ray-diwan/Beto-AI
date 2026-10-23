// Motor compartilhado pelos formulários e pela interpretação da mensagem.
function simNumero(x) {
  if (x == null || x === '') return NaN;
  if (typeof x === 'number') return x;
  var s = String(x).trim();
  if (!/^-?\d+(?:[.,]\d+)*$/.test(s)) return NaN;
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  return Number(s);
}
function simDinheiro(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function simCampos(d, comparar) {
  function campo(nome, rotulo, padrao, min, max) {
    return { nome: nome, rotulo: rotulo, tipo: 'numero', valor: d[nome] == null ? padrao : d[nome], obrigatorio: true, min: min, max: max };
  }
  var campos = [campo('banca', 'Saldo inicial (R$)', null, 0.01, 10000000),
    campo('valor', comparar ? 'Valor da aposta A (R$)' : 'Valor de cada aposta (R$)', null, 0.01, 10000000)];
  if (comparar) campos.push(campo('valor2', 'Valor da aposta B (R$)', null, 0.01, 10000000));
  campos.push(campo('odd', 'Odd das apostas', null, 1.01, 1000),
    campo('rodadas', 'Quantidade de apostas por cenário', 200, 1, 5000),
    campo('cenarios', 'Quantidade de cenários sorteados', 1000, 100, 5000),
    { nome: 'modeloProb', rotulo: 'Como definir a chance de ganhar?', tipo: 'opcoes', valor: d.modeloProb || 'estimada', obrigatorio: true,
      opcoes: [{ valor: 'estimada', rotulo: 'Hipótese pela odd e margem de 5%' }, { valor: 'informada', rotulo: 'Informar uma chance hipotética' }] },
    { nome: 'probabilidade', rotulo: 'Chance hipotética de ganhar (%; preencha se escolheu informar)', tipo: 'numero', valor: d.probabilidade == null ? null : d.probabilidade, obrigatorio: false, min: 0, max: 100 });
  return campos;
}
function simResposta(tipo, d, ctx, aviso) {
  var comparar = tipo === 'comparar_banca';
  return { tipo: 'confirmar', secao: { id: 'simulacao', titulo: 'Simulações' },
    trilha: [{ id: 'inicio', titulo: 'Início' }, { id: 'simulacao', titulo: 'Simulações' }],
    texto: (aviso ? aviso + '\n\n' : '') + 'Sorteio vários caminhos possíveis, com apostas de valor fixo e resultados independentes. Confira os dados. A simulação para de apostar quando o saldo não cobre a próxima aposta. A chance estimada pela odd é uma hipótese, não uma previsão de jogos.',
    formulario: { acao: 'calc', tipo: tipo, titulo: comparar ? 'Comparar valores de aposta' : 'Evolução da banca', botao: 'Executar simulação', campos: simCampos(d, comparar) },
    contexto: Object.assign({}, ctx, { secaoAtual: 'simulacao', simulacaoPendente: { tipo: tipo, dados: d } }),
    acoes: [{ rotulo: 'Outras simulações', acao: 'secao', secao: 'simulacao' }] };
}
function simAleatorio(seed) {
  var a = seed >>> 0;
  return function () { a += 0x6D2B79F5; var t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function simExecutarSerie(banca, aposta, odd, p, rodadas, cenarios, seed) {
  var rng = simAleatorio(seed), finais = [], media = new Array(rodadas + 1).fill(0), exemplos = [];
  var lucros = 0, insuficientes = 0, perdas = 0;
  var inicial = Math.round(banca * 100), custo = Math.round(aposta * 100), premio = Math.round(custo * odd);
  for (var s = 0; s < cenarios; s++) {
    var saldo = inicial, serie = [saldo / 100]; media[0] += saldo / 100;
    for (var r = 1; r <= rodadas; r++) {
      var ganhou = rng() < p; // Sorteia mesmo após parar: comparação usa as mesmas sequências.
      if (saldo >= custo) saldo += ganhou ? premio - custo : -custo;
      media[r] += saldo / 100;
      if (s < 5) serie.push(saldo / 100);
    }
    finais.push(saldo / 100);
    if (saldo > inicial) lucros++;
    if (saldo < inicial) perdas++;
    if (saldo < custo) insuficientes++;
    if (s < 5) exemplos.push(serie);
  }
  finais.sort(function (a, b) { return a - b; });
  function quantil(q) { var k = (finais.length - 1) * q, i = Math.floor(k); return finais[i] + (finais[Math.min(i + 1, finais.length - 1)] - finais[i]) * (k - i); }
  var indices = [0], passo = Math.max(1, Math.ceil(rodadas / 60));
  for (var j = passo; j < rodadas; j += passo) indices.push(j);
  indices.push(rodadas);
  return { aposta: aposta, mediaFinal: media[rodadas] / cenarios, mediana: quantil(0.5), p10: quantil(0.1), p90: quantil(0.9),
    pctLucro: lucros / cenarios * 100, pctPrejuizo: perdas / cenarios * 100, pctSemSaldo: insuficientes / cenarios * 100,
    indices: indices, media: indices.map(function (i) { return media[i] / cenarios; }),
    exemplos: exemplos.map(function (serie) { return indices.map(function (i) { return serie[i]; }); }) };
}
function simCalcular(tipo, dados, ctx, seedTeste) {
  var d = Object.assign({}, dados), comparar = tipo === 'comparar_banca';
  if (d.rodadas == null || d.rodadas === '') d.rodadas = 200;
  if (d.cenarios == null || d.cenarios === '') d.cenarios = 1000;
  if (!d.modeloProb) d.modeloProb = d.probabilidade != null && d.probabilidade !== '' ? 'informada' : 'estimada';
  var b = simNumero(d.banca), a = simNumero(d.valor), o = simNumero(d.odd), r = simNumero(d.rodadas), n = simNumero(d.cenarios), a2 = simNumero(d.valor2);
  var erros = [];
  if (!(b >= 0.01 && b <= 10000000)) erros.push('Informe um saldo inicial entre R$ 0,01 e R$ 10 milhões.');
  if (!(a >= 0.01 && a <= b)) erros.push('O valor da aposta deve ser positivo e caber no saldo inicial.');
  if (comparar && !(a2 >= 0.01 && a2 <= b)) erros.push('O valor da aposta B deve ser positivo e caber no saldo inicial.');
  if (!(o >= 1.01 && o <= 1000)) erros.push('Informe uma odd entre 1,01 e 1.000.');
  if (!(Number.isInteger(r) && r >= 1 && r <= 5000)) erros.push('Use de 1 a 5.000 apostas por cenário, em número inteiro.');
  if (!(Number.isInteger(n) && n >= 100 && n <= 5000)) erros.push('Use de 100 a 5.000 cenários, em número inteiro.');
  if (r * n > 2000000) erros.push('Quantidade de apostas × cenários deve ser no máximo 2 milhões. Reduza uma das quantidades.');
  var p;
  if (d.modeloProb === 'informada') { p = simNumero(d.probabilidade) / 100; if (!(p >= 0 && p <= 1)) erros.push('Informe uma chance entre 0% e 100%.'); }
  else if (d.modeloProb === 'estimada') p = 1 / (o * 1.05);
  else erros.push('Escolha como definir a chance de ganhar.');
  ['banca', 'valor'].concat(comparar ? ['valor2'] : []).forEach(function (k) { var v = simNumero(d[k]); if (Number.isFinite(v) && Math.abs(v * 100 - Math.round(v * 100)) > 0.00001) erros.push('Valores em reais devem ter no máximo duas casas decimais.'); });
  if (erros.length) return simResposta(tipo, d, ctx, erros.join('\n'));
  var seed = seedTeste == null ? Math.floor(Math.random() * 4294967296) : seedTeste;
  var resultados = [simExecutarSerie(b, a, o, p, r, n, seed)];
  if (comparar) resultados.push(simExecutarSerie(b, a2, o, p, r, n, seed));
  function pct(v) { return v.toFixed(1).replace('.', ',') + '%'; }
  var hipotese = d.modeloProb === 'informada' ? 'Chance hipotética informada: **' + pct(p * 100) + '**.' : 'Chance hipotética usada: **' + pct(p * 100) + '**, calculada por 1 ÷ (odd × 1,05). Essa hipótese de margem não determina a chance real de um jogo.';
  var texto = ['Executei **' + n + ' cenários**, com até **' + r + ' apostas** em cada um, saldo inicial de **' + simDinheiro(b) + '** e odd **' + o + '**.', hipotese];
  resultados.forEach(function (s, i) {
    texto.push('**' + (comparar ? (i === 0 ? 'A' : 'B') + ' — ' : '') + simDinheiro(s.aposta) + ' por aposta**',
      '- Saldo final médio: **' + simDinheiro(s.mediaFinal) + '**; mediana: **' + simDinheiro(s.mediana) + '**.',
      '- Faixa entre os percentis 10 e 90 dos saldos finais: **' + simDinheiro(s.p10) + ' a ' + simDinheiro(s.p90) + '**.',
      '- Terminaram com lucro: **' + pct(s.pctLucro) + '**; com prejuízo: **' + pct(s.pctPrejuizo) + '**.',
      '- Terminaram sem saldo suficiente para outra aposta: **' + pct(s.pctSemSaldo) + '**.');
  });
  texto.push('Valores de apostas ficam fixos. Não há depósitos adicionais. Os sorteios são independentes e os pagamentos são arredondados em centavos. ' + (comparar ? 'A e B usam as mesmas sequências de sorteios. ' : '') + 'As frequências variam entre execuções e não garantem resultados futuros.');
  var series = [];
  if (!comparar) resultados[0].exemplos.forEach(function (v, i) { series.push({ nome: 'Cenário ' + (i + 1), valores: v }); });
  resultados.forEach(function (s, i) { series.push({ nome: comparar ? 'Média ' + (i === 0 ? 'A' : 'B') : 'Média dos cenários', valores: s.media, media: true }); });
  var novoCtx = Object.assign({}, ctx, { secaoAtual: 'simulacao', ultimoCalc: tipo, ultimaSimulacao: { tipo: tipo, dados: d } });
  delete novoCtx.simulacaoPendente;
  return { tipo: 'simulacao', secao: { id: 'simulacao', titulo: 'Simulações' }, trilha: [{ id: 'inicio', titulo: 'Início' }, { id: 'simulacao', titulo: 'Simulações' }],
    texto: texto.join('\n\n'), resultado: { modelo: tipo, parametros: { banca: b, valores: comparar ? [a, a2] : [a], odd: o, probabilidade: p, modeloProb: d.modeloProb, rodadas: r, cenarios: n, seed: seed }, estatisticas: resultados.map(function (s) { var t = Object.assign({}, s); delete t.indices; delete t.media; delete t.exemplos; return t; }), visual: { grafico: { titulo: 'Evolução do saldo', indices: resultados[0].indices, series: series } } },
    acoes: [{ rotulo: 'Sortear novos cenários', acao: 'calc', tipo: tipo, dados: d }, { rotulo: 'Mudar os valores', acao: 'form', tipo: tipo, dados: d }, { rotulo: comparar ? 'Simular um valor' : 'Comparar dois valores', acao: 'form', tipo: comparar ? 'banca' : 'comparar_banca', dados: d }, { rotulo: 'Outras simulações', acao: 'secao', secao: 'simulacao' }], contexto: novoCtx };
}
