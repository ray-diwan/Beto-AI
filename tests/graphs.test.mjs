import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {validGraph} from '../lib/charts.mjs';
const engine=readFileSync(new URL('../n8n/motor-monte-carlo.js',import.meta.url),'utf8');
const addon=readFileSync(new URL('../n8n/graficos-v3.js',import.meta.url),'utf8');
const scope=vm.createContext({});vm.runInContext(engine+'\n'+addon,scope);
const base={banca:105,valor:10,odd:2,rodadas:20,cenarios:100,modeloProb:'informada',probabilidade:0,meses:12,taxaMensal:0};
const run=(data={},tipo='banca')=>scope.simCalcular(tipo,{...base,...data},{},12345);
const graph=(r,id)=>r.resultado.visual.graficos.find(g=>g.id===id);
test('gera nove gráficos válidos sem enviar amostras ou tabelas internas no contexto',()=>{
 const r=run();assert.equal(r.resultado.visual.graficos.length,9);r.resultado.visual.graficos.forEach(g=>assert.ok(validGraph(g),g.id));
 assert.ok(!JSON.stringify(r).includes('_finais'));assert.ok(!JSON.stringify(r).includes('_bandas'));assert.ok(JSON.stringify(r.contexto).length<1000);
});
test('histograma soma 100% inclusive quando todos os saldos são iguais',()=>{for(const p of [0,47,100]){const g=graph(run({probabilidade:p}),'distribuicao');assert.ok(Math.abs(g.series[0].valores.reduce((a,b)=>a+b,0)-100)<1e-9);}});
test('risco é acumulado e preserva saldo residual, bandas são ordenadas',()=>{
 const r=run(),risco=graph(r,'risco').series[0].valores;assert.equal(r.resultado.estatisticas[0].mediaFinal,5);assert.equal(risco.at(-1),100);assert.equal(risco[0],0);assert.ok(risco.every((v,i)=>i===0||v>=risco[i-1]));
 const f=graph(r,'faixa-0').faixa;assert.equal(f.inferior.at(-1),5);assert.equal(f.superior.at(-1),5);
});
test('fluxo financeiro reconcilia capital e saldo final com parada por insuficiência',()=>{
 for(const p of [0,47,100]){const r=run({probabilidade:p}),v=graph(r,'fluxos').series[0].valores;assert.ok(Math.abs(v[1]-v[0]-v[2])<1e-8);assert.ok(Math.abs(105+v[2]-r.resultado.estatisticas[0].mediaFinal)<1e-8);}
});
test('comparação usa faixas comuns e preserva as mesmas sequências em valores iguais',()=>{
 const r=run({valor2:10,probabilidade:47},'comparar_banca');assert.equal(r.resultado.visual.graficos.length,10);assert.deepEqual(r.resultado.estatisticas[0],r.resultado.estatisticas[1]);
 const g=graph(r,'distribuicao');assert.deepEqual(g.series[0].valores,g.series[1].valores);
});
test('guardar e aplicar partem do mesmo capital e respeitam taxa e horizonte',()=>{
 const g=graph(run({taxaMensal:1,meses:12}),'oportunidade');assert.ok(g.series.every(s=>s.valores[0]===105));assert.equal(g.series.at(-2).valores.at(-1),105);assert.ok(Math.abs(g.series.at(-1).valores.at(-1)-105*1.01**12)<1e-8);
 assert.equal(run({meses:0}).tipo,'confirmar');assert.equal(run({taxaMensal:6}).tipo,'confirmar');
});
test('convergência e sequências têm interpretações exatas nos casos extremos',()=>{
 for(const p of [0,100]){const r=run({probabilidade:p}),g=graph(r,'convergencia');assert.deepEqual(g.series[0].valores,g.series[1].valores);}
 const seq=graph(run({probabilidade:47}),'sequencias');assert.ok(seq.series[0].valores.every(v=>v===47));assert.equal(seq.series[1].valores[0],100);assert.ok(Math.abs(seq.series[1].valores[2]-28.09)<1e-8);
});
test('dobrar distingue próxima aposta do capital total e do orçamento',()=>{const g=graph(run(),'dobrar');assert.equal(g.series[0].valores[3],80);assert.equal(g.series[1].valores[3],150);assert.equal(g.series[2].valores[3],105);});
test('validação de gráficos rejeita números não finitos, bandas invertidas e dados excessivos',()=>{
 const g=JSON.parse(JSON.stringify(graph(run(),'faixa-0')));g.series[0].valores[0]=Infinity;assert.equal(validGraph(g),false);g.series[0].valores[0]=0;g.faixa.inferior[0]=1000;assert.equal(validGraph(g),false);
});
