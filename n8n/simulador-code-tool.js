// Cole este conteúdo no Custom Code Tool do n8n. query deve ser JSON válido.
const p = JSON.parse(query);
const { banca = 1000, aposta = 50, odd = 1.95, prob = 0.5,
  rodadas = 500, simulacoes = 5 } = p;
if (![banca,aposta,odd,prob,rodadas,simulacoes].every(Number.isFinite) ||
    banca <= 0 || aposta <= 0 || odd <= 1 || prob < 0 || prob > 1 ||
    !Number.isInteger(rodadas) || rodadas < 1 || rodadas > 5000 ||
    !Number.isInteger(simulacoes) || simulacoes < 1 || simulacoes > 8) {
  return JSON.stringify({ mensagem: 'Parâmetros inválidos: banca/aposta positivas, odd > 1, prob entre 0 e 1, rodadas de 1 a 5000 e simulações de 1 a 8.' });
}
const cores = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#34495e'];
const datasets = [], finais = [];
for (let s = 0; s < simulacoes; s++) {
  let saldo = banca;
  const serie = [saldo];
  for (let r = 0; r < rodadas; r++) {
    if (saldo >= aposta) saldo += Math.random() < prob ? aposta * (odd - 1) : -aposta;
    serie.push(Number(saldo.toFixed(2)));
  }
  finais.push(saldo);
  datasets.push({label:`Sim ${s+1}`,data:serie,borderColor:cores[s],fill:false,pointRadius:0,borderWidth:2});
}
const config = {type:'line',data:{labels:Array.from({length:rodadas+1},(_,i)=>i),datasets},options:{title:{display:true,text:'Simulação de apostas — evolução da banca'},scales:{xAxes:[{scaleLabel:{display:true,labelString:'Aposta nº'}}],yAxes:[{scaleLabel:{display:true,labelString:'Banca (R$)'}}]}}};
// Retorne os dados para o site desenhar o gráfico sem depender de URL longa.
return JSON.stringify({
  mensagem:'Trajetórias ilustrativas com apostas independentes, probabilidade e odd constantes, sem aportes. Não são previsão. Poucas trajetórias não estimam o risco com precisão.',
  grafico:config,
  saldo_final_medio:Number((finais.reduce((a,b)=>a+b,0)/finais.length).toFixed(2)),
  valor_esperado_por_aposta_pct:Number(((prob*odd-1)*100).toFixed(2))
});
