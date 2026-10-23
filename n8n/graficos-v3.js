// Append after motor-simulacao.js, before the node's routing/execution code.
// Aggregates stay on the server; raw scenario arrays never enter conversation state.
var simCamposV2 = simCampos;
simCampos = function(d, comparar) {
  return simCamposV2(d, comparar).concat([
    {nome:'meses',rotulo:'Horizonte da comparação com guardar (meses)',tipo:'numero',valor:d.meses == null ? 12 : d.meses,obrigatorio:true,min:1,max:120},
    {nome:'taxaMensal',rotulo:'Rendimento mensal hipotético (%; 0 = sem rendimento)',tipo:'numero',valor:d.taxaMensal == null ? 0 : d.taxaMensal,obrigatorio:true,min:0,max:5}
  ]);
};

function simQuantil(v,q) {
  var k=(v.length-1)*q, i=Math.floor(k);
  return v[i]+(v[Math.min(i+1,v.length-1)]-v[i])*(k-i);
}
// Replaces the v2 sampler while preserving its sampling order and stopping rule.
simExecutarSerie = function(banca,aposta,odd,p,rodadas,cenarios,seed) {
  var indices=[0], passo=Math.max(1,Math.ceil(rodadas/60));
  for(var j=passo;j<rodadas;j+=passo) indices.push(j);
  indices.push(rodadas);
  var rng=simAleatorio(seed), inic=Math.round(banca*100), custo=Math.round(aposta*100), premio=Math.round(custo*odd);
  var amostras=indices.map(function(){return [];}), somas=indices.map(function(){return 0;}), semSaldo=indices.map(function(){return 0;});
  var finais=[], exemplos=[], lucros=0, perdas=0, insuficientes=0, apostado=0, recebido=0;
  for(var s=0;s<cenarios;s++) {
    var saldo=inic, pos=1, serie=[banca];
    amostras[0].push(banca); somas[0]+=banca;
    for(var r=1;r<=rodadas;r++) {
      var ganhou=rng()<p;
      if(saldo>=custo) {
        apostado+=custo;
        if(ganhou) recebido+=premio;
        saldo+=ganhou ? premio-custo : -custo;
      }
      if(r===indices[pos]) {
        var reais=saldo/100;
        amostras[pos].push(reais); somas[pos]+=reais;
        if(saldo<custo) semSaldo[pos]++;
        if(s<5) serie.push(reais);
        pos++;
      }
    }
    finais.push(saldo/100);
    if(saldo>inic) lucros++;
    if(saldo<inic) perdas++;
    if(saldo<custo) insuficientes++;
    if(s<5) exemplos.push(serie);
  }
  finais.sort(function(a,b){return a-b;});
  var bandas={p10:[],mediana:[],p90:[]};
  amostras.forEach(function(v){v.sort(function(a,b){return a-b;});bandas.p10.push(simQuantil(v,.1));bandas.mediana.push(simQuantil(v,.5));bandas.p90.push(simQuantil(v,.9));});
  return {aposta:aposta,mediaFinal:somas[somas.length-1]/cenarios,mediana:simQuantil(finais,.5),p10:simQuantil(finais,.1),p90:simQuantil(finais,.9),
    pctLucro:lucros/cenarios*100,pctPrejuizo:perdas/cenarios*100,pctSemSaldo:insuficientes/cenarios*100,
    indices:indices,media:somas.map(function(v){return v/cenarios;}),exemplos:exemplos,
    _finais:finais,_bandas:bandas,_risco:semSaldo.map(function(v){return v/cenarios*100;}),
    _fluxos:{apostado:apostado/100/cenarios,recebido:recebido/100/cenarios},_indices:indices};
};

function simGraficosV3(res,d) {
  var par=res.parametros, stats=res.estatisticas, compare=stats.length===2, cores=['#298574','#c69446'];
  var ids=stats[0]._indices, graphs=[];
  function linha(id,titulo,unidade,labels,series,nota,x) {return {id:id,titulo:titulo,tipo:'linha',unidade:unidade,eixoX:x||'Número da aposta',eixoY:unidade==='percentual'?'Percentual (%)':'Valor (R$)',labels:labels,series:series,nota:nota};}
  function serie(nome,valores,i) {return {nome:nome,valores:valores,cor:cores[i%2]};}
  function nome(i) {return compare ? (i===0?'A':'B')+' — '+simDinheiro(stats[i].aposta) : simDinheiro(stats[i].aposta)+' por aposta';}
  var palette=['#298574','#c69446','#7c74a9','#5c8fb8','#b57372','#234b3c'];
  graphs.push(linha('evolucao','Evolução da banca','BRL',ids,res.visual.grafico.series.map(function(s,i){return {nome:s.nome,valores:s.valores,cor:palette[i%palette.length]};}),'Trajetórias ilustrativas e média dos cenários. As trajetórias exibidas são uma pequena amostra; consulte também a distribuição e a faixa de resultados.'));
  var todos=stats.reduce(function(v,s){return v.concat(s._finais);},[]), min=Math.min.apply(null,todos), max=Math.max.apply(null,todos);
  var count=min===max?1:Math.min(20,Math.max(5,Math.ceil(Math.sqrt(stats[0]._finais.length)))), largura=count===1?1:(max-min)/count;
  var labels=[];
  for(var k=0;k<count;k++) labels.push(count===1?simDinheiro(min):simDinheiro(min+k*largura)+' a '+simDinheiro(min+(k+1)*largura));
  var hist=stats.map(function(s,i){var bins=new Array(count).fill(0);s._finais.forEach(function(v){bins[Math.min(count-1,Math.floor((v-min)/largura))]++;});return serie(nome(i),bins.map(function(v){return v/s._finais.length*100;}),i);});
  graphs.push({id:'distribuicao',titulo:'Como terminaram os cenários?',tipo:'barras',unidade:'percentual',eixoX:'Faixas de saldo final (R$)',eixoY:'Cenários (%)',labels:labels,series:hist,
    nota:'Saldo inicial: '+simDinheiro(par.banca)+'. Cada barra agrupa saldos finais; o limite superior entra só na última faixa. Média e mediana estão no resumo. As faixas são iguais para A e B.'});
  var risco=stats.map(function(s,i){return serie(nome(i),s._risco,i);});
  graphs.push(linha('risco','Quando o saldo fica insuficiente?','percentual',ids,risco,'Percentual acumulado de cenários sem saldo para a próxima aposta. O saldo restante é preservado; não há novos depósitos.'));
  var bandas=[];
  stats.forEach(function(s,i){var g=linha('faixa-'+i,'Faixa de resultados — '+nome(i),'BRL',ids,[serie('Mediana',s._bandas.mediana,i)],'A faixa sombreada contém os percentis 10 a 90 em cada rodada. É dispersão dos cenários, não intervalo de confiança da média nem garantia.');g.tipo='faixa';g.faixa={inferior:s._bandas.p10,superior:s._bandas.p90,cor:cores[i]};bandas.push(g);});
  graphs=graphs.concat(bandas);
  var meses=simNumero(d.meses), taxa=simNumero(d.taxaMensal)/100, periodos=[], oportunidades=[];
  for(var m=0;m<=meses;m++) periodos.push(m);
  stats.forEach(function(s,i){
    // IDs are sampled; interpolate the displayed mean at the monthly round position.
    var medias=res.visual.grafico.series.filter(function(g){return g.media;})[i].valores;
    var vals=periodos.map(function(m){var alvo=par.rodadas*m/meses, j=0;while(j<ids.length-2&&ids[j+1]<alvo)j++;var w=(alvo-ids[j])/(ids[j+1]-ids[j]);return medias[j]+w*(medias[j+1]-medias[j]);});
    oportunidades.push(serie('Apostas — '+nome(i),vals,i));
  });
  oportunidades.push({nome:'Guardar sem rendimento',valores:periodos.map(function(){return par.banca;}),cor:'#7c74a9'});
  oportunidades.push({nome:'Aplicar à taxa hipotética',valores:periodos.map(function(m){return par.banca*Math.pow(1+taxa,m);}),cor:'#5c8fb8'});
  graphs.push(linha('oportunidade','E se eu guardasse esse dinheiro?','BRL',periodos,oportunidades,'Mesmo capital inicial de '+simDinheiro(par.banca)+', sem aportes ou retiradas, em '+meses+' meses. As '+par.rodadas+' apostas são distribuídas nesse horizonte. Rendimento hipotético de '+d.taxaMensal+'% ao mês, sem impostos, taxas ou inflação; não é cotação ou promessa de retorno.','Meses'));
  var convLabels=ids.slice(1), convergence=[];
  stats.forEach(function(s,i){
    var rng=simAleatorio((par.seed^0x5bd1e995)>>>0), soma=0, j=0, vals=[], stake=Math.round(s.aposta*100), prize=Math.round(stake*par.odd);
    for(var r=1;r<=par.rodadas;r++){soma+=rng()<par.probabilidade?prize-stake:-stake;if(r===convLabels[j]){vals.push(soma/100/r);j++;}}
    convergence.push(serie('Média observada — '+nome(i),vals,i));
    convergence.push({nome:'Valor esperado — '+nome(i),valores:convLabels.map(function(){return (par.probabilidade*prize-stake)/100;}),cor:cores[i],tracejado:true});
  });
  graphs.push(linha('convergencia','Ganhar no começo prova alguma coisa?','BRL',convLabels,convergence,'Sequência didática independente, sem limite de banca, para visualizar a média do resultado líquido por aposta. Mais repetições não garantem convergência monotônica nem lucro.'));
  graphs.push({id:'fluxos',titulo:'Prêmio recebido é igual a lucro?',tipo:'barras',unidade:'BRL',eixoX:'Movimentação acumulada',eixoY:'Média por cenário (R$)',labels:['Total apostado','Pagamentos recebidos','Resultado líquido'],series:stats.map(function(s,i){return serie(nome(i),[s._fluxos.apostado,s._fluxos.recebido,s._fluxos.recebido-s._fluxos.apostado],i);}),nota:'Valores médios de todos os cenários, considerando a parada por saldo insuficiente. O total apostado pode superar o capital inicial porque os pagamentos são reutilizados. Saldo final = capital inicial + resultado líquido.'});
  var sequencias=[];for(var l=0;l<=10;l++)sequencias.push(l);
  graphs.push(linha('sequencias','Uma sequência ruim muda a próxima chance?','percentual',sequencias,[{nome:'Chance da próxima vitória',valores:sequencias.map(function(){return par.probabilidade*100;}),cor:cores[0]},{nome:'Chance de perder as primeiras k apostas',valores:sequencias.map(function(k){return Math.pow(1-par.probabilidade,k)*100;}),cor:cores[1]}], 'No modelo de apostas independentes com chance fixa, o histórico não muda a próxima chance. A outra curva é a chance de uma sequência inicial específica de k perdas; não é a chance de uma sequência aparecer em qualquer lugar.','Número k de perdas seguidas'));
  var etapas=[];for(var l=0;l<=Math.min(12,par.rodadas);l++)etapas.push(l);
  var aposta=stats[0].aposta;
  graphs.push({id:'dobrar',titulo:'Quanto exige dobrar após cada perda?',tipo:'barras',unidade:'BRL',eixoX:'Perdas consecutivas antes da próxima aposta',eixoY:'Valor necessário (R$)',labels:etapas,series:[{nome:'Próxima aposta',valores:etapas.map(function(k){return aposta*Math.pow(2,k);}),cor:cores[0]},{nome:'Capital total para chegar à próxima aposta',valores:etapas.map(function(k){return aposta*(Math.pow(2,k+1)-1);}),cor:cores[1]},{nome:'Banca disponível',valores:etapas.map(function(){return par.banca;}),cor:'#b57372',tracejado:true}],nota:'Exercício de exigência de capital começando em '+simDinheiro(aposta)+'. Capital total inclui as apostas perdidas e a próxima aposta. Não pressupõe que uma vitória recupere as perdas; isso depende da odd e dos limites disponíveis.'});
  return graphs;
}
var simCalcularV2 = simCalcular;
simCalcular = function(tipo,dados,ctx,seedTeste) {
  var d=Object.assign({},dados);
  if(d.meses==null||d.meses==='')d.meses=12;
  if(d.taxaMensal==null||d.taxaMensal==='')d.taxaMensal=0;
  if(!(Number.isInteger(simNumero(d.meses))&&simNumero(d.meses)>=1&&simNumero(d.meses)<=120))return simResposta(tipo,d,ctx,'Informe de 1 a 120 meses inteiros.');
  if(!(simNumero(d.taxaMensal)>=0&&simNumero(d.taxaMensal)<=5))return simResposta(tipo,d,ctx,'Informe uma taxa mensal hipotética entre 0% e 5%.');
  var resposta=simCalcularV2(tipo,d,ctx,seedTeste);
  if(resposta.resultado) {
    resposta.resultado.visual.graficos=simGraficosV3(resposta.resultado,d);
    resposta.resultado.estatisticas.forEach(function(s){Object.keys(s).forEach(function(k){if(k[0]==='_')delete s[k];});});
    resposta.texto+='\n\nUse os botões dos gráficos para explorar distribuição, risco, faixa de resultados, custo de oportunidade e vieses. Para alterar o horizonte ou a taxa hipotética, use **Mudar os valores**.';
  }
  return resposta;
};
