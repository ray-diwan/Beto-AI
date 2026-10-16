import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize} from '../lib/normalize.mjs';
import handler from '../api/chat.mjs';
import {readFileSync} from 'node:fs';
test('aceita o output original QuickChart e extrai dados sem executar código',()=>{
 const config={type:'line',data:{labels:[0,1],datasets:[{label:'Sim 1',data:[100,90],borderColor:'#3498db'}]}};
 const result=normalize([{output:JSON.stringify({grafico_url:'https://quickchart.io/chart?c='+encodeURIComponent(JSON.stringify(config)),saldo_final_medio:90})}]);
 assert.deepEqual(result.grafico.data.datasets[0].data,[100,90]);assert.equal(result.metricas.saldo_final_medio,90);
});
test('preserva texto e recusa URL não HTTPS',()=>{assert.equal(normalize('Olá').mensagem,'Olá');assert.equal(normalize({grafico_url:'javascript:alert(1)'}).grafico_url,undefined)});
test('rejeita dados de gráfico inválidos',()=>{assert.equal(normalize({grafico:{data:{labels:[0],datasets:[{data:['abc']}]}}}).grafico,undefined)});
test('simulador preserva saldo residual e valida entrada',()=>{
 const run=new Function('query',readFileSync(new URL('../n8n/simulador-code-tool.js',import.meta.url),'utf8'));
 const result=JSON.parse(run(JSON.stringify({banca:110,aposta:50,prob:0,rodadas:4,simulacoes:1})));
 assert.deepEqual(result.grafico.data.datasets[0].data,[110,60,10,10,10]);assert.equal(result.saldo_final_medio,10);
 assert.match(JSON.parse(run('{"prob":2}')).mensagem,/inválidos/);
});
test('API encaminha mensagem e sessão, normaliza saída e não expõe token',async()=>{
 const originalFetch=globalThis.fetch;process.env.N8N_WEBHOOK_URL='https://example.com/webhook';process.env.N8N_WEBHOOK_TOKEN='test-only';
 globalThis.fetch=async(url,opts)=>{assert.equal(JSON.parse(opts.body).chatInput,'Oi');assert.equal(opts.headers.Authorization,'Bearer test-only');return {ok:true,text:async()=>JSON.stringify({output:'Olá!'})};};
 const res={setHeader(){},status(c){this.code=c;return this},json(v){this.data=v}};
 try{await handler({method:'POST',headers:{host:'localhost'},body:{message:'Oi',sessionId:'test-session-123'}},res);assert.equal(res.code,200);assert.equal(res.data.mensagem,'Olá!');assert.ok(!JSON.stringify(res.data).includes('test-only'));}
 finally{globalThis.fetch=originalFetch;delete process.env.N8N_WEBHOOK_URL;delete process.env.N8N_WEBHOOK_TOKEN;}
});
