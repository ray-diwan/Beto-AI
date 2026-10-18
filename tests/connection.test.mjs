import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/chat.mjs';
test('distingue falhas do n8n e aceita resposta final', async()=>{
 const original=globalThis.fetch;
 const oldUrl=process.env.N8N_WEBHOOK_URL;
 process.env.N8N_WEBHOOK_URL=' https://example.com/webhook/test ';
 const req={method:'POST',headers:{host:'localhost'},body:{message:'Oi',sessionId:'diagnostico-123'}};
 const cases=[
  [404,'','N8N_NOT_FOUND'],[401,'','N8N_AUTH'],[403,'','N8N_AUTH'],
  [405,'','N8N_METHOD'],[500,'','N8N_EXECUTION'],[200,'','N8N_EMPTY'],
  [200,'{"message":"Workflow was started"}','N8N_ACK_ONLY'],
  [200,'<!doctype html><html>login</html>','N8N_HTML']
 ];
 try {
  for(const [status,raw,code]of cases){
   globalThis.fetch=async(url)=>{assert.equal(url.href,'https://example.com/webhook/test');return {status,ok:status===200,text:async()=>raw};};
   const res={setHeader(){},status(c){this.http=c;return this;},json(data){this.data=data;}};
   await handler(req,res);assert.equal(res.data.code,code);assert.equal(res.http,502);
  }
  globalThis.fetch=async()=>{throw Object.assign(new Error(),{name:'TimeoutError'})};
  const res={setHeader(){},status(c){this.http=c;return this},json(data){this.data=data}};
  await handler(req,res);assert.equal(res.http,504);assert.equal(res.data.code,'N8N_TIMEOUT');
  globalThis.fetch=async()=>({ok:true,status:200,text:async()=>'{"output":"Ol�, sou o Beto!"}'});
  await handler(req,res);assert.equal(res.http,200);assert.equal(res.data.mensagem,'Ol�, sou o Beto!');
 } finally {globalThis.fetch=original;if(oldUrl===undefined)delete process.env.N8N_WEBHOOK_URL;else process.env.N8N_WEBHOOK_URL=oldUrl;}
});