import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/chat.mjs';
import {workflowRequest} from '../lib/request.mjs';
import {normalize} from '../lib/normalize.mjs';

test('preserva menus, sugestões, formulário e contexto em envelopes n8n',()=>{
  const response={texto:'Confira os dados',contexto:{secaoAtual:'simulacao',simulacaoPendente:{tipo:'banca',dados:{banca:500}}},acoes:[{rotulo:'Mudar valores',acao:'form',tipo:'banca',dados:{banca:500}}],botoes:[{id:'riscos',titulo:'Riscos'}],formulario:{tipo:'banca',campos:[{nome:'odd',tipo:'numero'}]}};
  const result=normalize([{json:{resposta:response}}]);
  assert.equal(result.mensagem,response.texto);
  for(const key of ['contexto','acoes','botoes','formulario'])assert.deepEqual(result[key],response[key]);
});
test('converte gráfico do motor v2 e recusa séries inválidas',()=>{
  const r={texto:'Resultado',resultado:{visual:{grafico:{indices:[0,10],series:[{nome:'Média A',valores:[500,490]},{nome:'Média B',valores:[500,480]}]}}}};
  assert.deepEqual(normalize(r).grafico.data.datasets[1].data,[500,480]);
  r.resultado.visual.grafico.series[0].valores=[500];
  assert.equal(normalize(r).grafico,undefined);
});
test('valida ações, limites e contexto antes de chamar o workflow',()=>{
  const base={sessionId:'workflow-test-123'};
  assert.throws(()=>workflowRequest({...base,acao:'delete'}));
  assert.throws(()=>workflowRequest({...base,message:'a'.repeat(501)}));
  assert.throws(()=>workflowRequest({...base,message:'Oi',contexto:[]}));
  assert.throws(()=>workflowRequest({...base,acao:'calc',tipo:'banca',dados:[]}));
  assert.deepEqual(workflowRequest({...base,acao:'secao',secao:'inicio'}),{...base,acao:'secao',secao:'inicio',contexto:{}});
});
test('API encaminha ações e estado, mantendo dados calculados e sugestões',async()=>{
  const original=globalThis.fetch,oldUrl=process.env.N8N_WEBHOOK_URL;
  process.env.N8N_WEBHOOK_URL='https://example.com/webhook/bets-assistente';
  const contexto={secaoAtual:'simulacao',ultimaSimulacao:{tipo:'banca',dados:{banca:500}}};
  try{
    for(const action of [{acao:'mensagem',texto:'E se eu apostar R$ 5?'},{acao:'form',tipo:'banca',dados:{banca:500}},{acao:'calc',tipo:'banca',dados:{banca:500,valor:5,odd:2}},{acao:'secao',secao:'simulacao'}]){
      globalThis.fetch=async(url,opts)=>{
        const body=JSON.parse(opts.body);assert.equal(body.acao,action.acao);assert.deepEqual(body.contexto,contexto);
        if(action.dados)assert.deepEqual(body.dados,action.dados);
        if(action.texto)assert.equal(body.texto,action.texto);
        return {ok:true,status:200,text:async()=>JSON.stringify({texto:'Resposta do fluxo',contexto,acoes:[{rotulo:'Mudar valores',acao:'form',tipo:'banca'}]})};
      };
      const res={setHeader(){},status(c){this.code=c;return this;},json(v){this.data=v;}};
      await handler({method:'POST',headers:{host:'localhost'},body:{...action,sessionId:'workflow-test-123',contexto}},res);
      assert.equal(res.code,200);assert.equal(res.data.mensagem,'Resposta do fluxo');assert.deepEqual(res.data.contexto,contexto);assert.equal(res.data.acoes[0].acao,'form');
    }
  }finally{globalThis.fetch=original;if(oldUrl===undefined)delete process.env.N8N_WEBHOOK_URL;else process.env.N8N_WEBHOOK_URL=oldUrl;}
});
