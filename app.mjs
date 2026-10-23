import { renderGraphExplorer } from './lib/charts.mjs';
const $ = s => document.querySelector(s);
const messages = $('#messages');
let sessionId = crypto.randomUUID();
let busy = false;
let contexto = {};
const currency = x => x.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
function element(tag, cls, text) { const e = document.createElement(tag); if(cls)e.className=cls; if(text!==undefined)e.textContent=text; return e; }
function svgElement(tag, attrs) { const e=document.createElementNS('http://www.w3.org/2000/svg',tag); for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v); return e; }
function richText(text) {
  const box=element('div','text');
  // Support emphasis without interpreting HTML, links or scripts from the model.
  const source=String(text || '').replace(/\\n/g,'\n');
  const emphasis=/(\*{2,})([^*]+?)\1/g;
  let end=0;
  for(const match of source.matchAll(emphasis)) {
    box.append(document.createTextNode(source.slice(end,match.index)),element('strong','',match[2]));
    end=match.index+match[0].length;
  }
  box.append(document.createTextNode(source.slice(end)));
  return box;
}
function chips(title, items, makePayload, state) {
  const group=element('div','workflow chips');
  if(title)group.append(element('p','chip-title',title));
  for(const item of items.slice(0,20)) {
    if(!item || typeof item!=='object')continue;
    const button=element('button','chip',item.rotulo || item.titulo || 'Continuar');button.type='button';
    button.addEventListener('click',()=>request(makePayload(item),button.textContent,state));group.append(button);
  }
  return group;
}
function workflowForm(spec,state) {
  const form=element('form','workflow calculator');
  form.append(element('h3','',spec.titulo || 'Confira os valores'));
  if(spec.tipo==='banca' || spec.tipo==='comparar_banca')form.append(element('p','graph-note','Ao executar, você terá gráficos de trajetórias, distribuição, risco, faixa de resultados, guardar ou aplicar, valor esperado, prêmio e lucro, sequências e dobrar após perder.'));
  const controls=[];
  for(const field of spec.campos.slice(0,20)) {
    if(!field || typeof field.nome!=='string')continue;
    const label=element('label','field',field.rotulo || field.nome);
    const input=element(field.tipo==='opcoes'?'select':'input');
    if(field.tipo==='opcoes') {
      input.append(new Option('Selecione…',''));
      for(const option of (Array.isArray(field.opcoes)?field.opcoes:[]).slice(0,20))input.append(new Option(option.rotulo,option.valor));
    } else {
      input.type=field.tipo==='numero'?'number':'text';input.maxLength=500;
      if(input.type==='number') {input.step='any';input.inputMode='decimal';if(Number.isFinite(field.min))input.min=field.min;if(Number.isFinite(field.max))input.max=field.max;}
    }
    input.value=field.valor ?? '';input.required=!!field.obrigatorio;input.placeholder=field.placeholder || '';
    label.append(input);form.append(label);controls.push({field,input});
  }
  const error=element('p','form-error');error.setAttribute('role','alert');
  const button=element('button','chip primary',spec.botao || 'Calcular');button.type='submit';form.append(error,button);
  form.addEventListener('submit',event=>{
    event.preventDefault();if(busy)return;
    const dados=Object.fromEntries(controls.map(({field,input})=>[field.nome,input.value.trim()]));
    if(dados.modeloProb==='informada' && !dados.probabilidade){error.textContent='Informe a chance hipotética de ganhar.';return;}
    error.textContent='';request({acao:spec.acao || 'calc',tipo:spec.tipo,dados},spec.titulo || 'Calcular',state);
  });
  return form;
}
function resultVisual(result) {
  const box=element('div','result-visual'),v=result?.visual;
  if(!v)return box;
  if(Array.isArray(v.graficos))box.append(renderGraphExplorer(v.graficos));
  if(Array.isArray(v.barras))for(const bar of v.barras.slice(0,12))if(Number.isFinite(bar.valor))box.append(element('p','result-value',`${bar.rotulo}: ${currency(bar.valor)}`));
  if(Array.isArray(v.destaques))for(const d of v.destaques.slice(0,12))box.append(element('p','result-value',`${d.rotulo}: ${d.valor}`));
  if(v.pessoas)box.append(element('p','result-value',`${v.pessoas.titulo || ''}: ${v.pessoas.ganham} de 10 ${v.pessoas.ganhaTxt || ''}.`));
  return box;
}
function drawChart(chart) {
  const wrap=element('div','chart-card');
  wrap.append(element('h3','','Evolução da banca'),element('small','','Passe o cursor sobre uma linha para consultar os valores.'));
  const {labels,datasets}=chart.data;
  const w=720,h=300,left=68,right=15,top=20,bottom=45;
  let min=0,max=1; for(const d of datasets)for(const v of d.data){min=Math.min(min,v);max=Math.max(max,v);}
  max+=Math.max(1,(max-min)*.08);
  const x=i=>left+i*(w-left-right)/Math.max(1,labels.length-1);
  const y=v=>h-bottom-(v-min)*(h-top-bottom)/(max-min);
  const svg=svgElement('svg',{viewBox:`0 0 ${w} ${h}`,role:'img','aria-label':'Gráfico das trajetórias simuladas da banca em reais'});
  for(let i=0;i<=4;i++){
    const v=min+(max-min)*i/4, yy=y(v);
    svg.append(svgElement('line',{x1:left,x2:w-right,y1:yy,y2:yy,stroke:'#edf0e8'}));
    const t=svgElement('text',{x:left-9,y:yy+4,'text-anchor':'end',fill:'#82917b','font-size':11});t.textContent=Math.round(v).toLocaleString('pt-BR');svg.append(t);
  }
  for(let i=0;i<=4;i++){
    const j=Math.round((labels.length-1)*i/4),t=svgElement('text',{x:x(j),y:h-22,'text-anchor':'middle',fill:'#82917b','font-size':11});t.textContent=labels[j];svg.append(t);
  }
  for(const d of datasets){
    const path=svgElement('polyline',{points:d.data.map((v,i)=>`${x(i)},${y(v)}`).join(' '),fill:'none',stroke:d.borderColor,'stroke-width':2,'stroke-linejoin':'round'});
    const title=svgElement('title',{});title.textContent=d.label;path.append(title);svg.append(path);
  }
  const marker=svgElement('line',{x1:0,x2:0,y1:top,y2:h-bottom,stroke:'#335c45','stroke-dasharray':'3 4',visibility:'hidden'});svg.append(marker);
  const readout=element('p','legend','Eixo horizontal: número da aposta · Eixo vertical: saldo em R$');
  svg.addEventListener('pointermove',event=>{const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const local=point.matrixTransform(svg.getScreenCTM().inverse());const j=Math.max(0,Math.min(labels.length-1,Math.round((local.x-left)/(w-left-right)*(labels.length-1))));marker.setAttribute('x1',x(j));marker.setAttribute('x2',x(j));marker.setAttribute('visibility','visible');readout.textContent=`Aposta ${labels[j]} · `+datasets.map(d=>`${d.label}: ${currency(d.data[j])}`).join(' · ');});
  svg.addEventListener('pointerleave',()=>marker.setAttribute('visibility','hidden'));
  wrap.append(svg);
  const legend=element('div','legend');for(const d of datasets){const item=element('span','',d.label),dot=element('i');dot.style.backgroundColor=d.borderColor;item.prepend(dot);legend.append(item);}wrap.append(legend,readout);
  const details=element('details');details.append(element('summary','','Consultar dados em tabela'));const table=element('table');table.style.fontSize='11px';const head=element('tr');for(const v of ['Aposta',...datasets.map(d=>d.label)])head.append(element('th','',v));table.append(head);for(let j=0;j<labels.length;j++){const tr=element('tr');for(const v of [labels[j],...datasets.map(d=>currency(d.data[j]))])tr.append(element('td','',v));table.append(tr);}details.append(table);wrap.append(details);
  return wrap;
}
function addMessage(role,data,demo=false){
  $('#welcome')?.remove();const box=element('article',`msg ${role}`);box.append(element('div','who',role==='user'?'VOCÊ':'BETO'));
  if(demo)box.append(element('span','demo-label','DEMONSTRAÇÃO LOCAL · sem conexão com IA'));
  box.append(richText(data.mensagem));
  if(data.grafico&&!data.resultado?.visual?.graficos?.length)box.append(drawChart(data.grafico));
  else if(data.grafico_url){const img=element('img','chart-img');img.src=data.grafico_url;img.alt='Gráfico da simulação';img.loading='lazy';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>img.replaceWith(element('p','','Não foi possível carregar o gráfico.')));box.append(img);}
  if(data.metricas&&Object.keys(data.metricas).length){const metrics=element('div','metrics');for(const [k,v]of Object.entries(data.metricas)){const m=element('div','metric',k==='saldo_final_medio'?'Saldo final médio das trajetórias':'Valor esperado por aposta');m.append(element('strong','',k==='saldo_final_medio'?currency(v):`${v.toLocaleString('pt-BR')}%`));metrics.append(m);}box.append(metrics);}
  if(role==='assistant'&&!demo){
    const state=data.contexto || contexto;
    if(data.resultado)box.append(resultVisual(data.resultado));
    if(Array.isArray(data.formulario?.campos))box.append(workflowForm(data.formulario,state));
    if(Array.isArray(data.acoes))box.append(chips(data.acoesTitulo ?? 'Continue a conversa',data.acoes,a=>({acao:a.acao,secao:a.secao,tipo:a.tipo,dados:a.dados}),state));
    if(Array.isArray(data.botoes))box.append(chips('Temas relacionados',data.botoes,b=>({acao:'secao',secao:b.id}),state));
  }
  messages.append(box);messages.scrollTop=messages.scrollHeight;
}
async function request(payload,label,state=contexto){
  if(busy)return;busy=true;$('#send').disabled=true;$('#status').textContent='Beto está pensando…';
  const controls=[...document.querySelectorAll('.workflow button,.workflow input,.workflow select')];
  const previous=controls.map(control=>control.disabled);controls.forEach(control=>control.disabled=true);
  if(label)addMessage('user',{mensagem:label});
  $('#retry')?.remove();let success=false;
  try{
    const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,sessionId,contexto:state}),signal:AbortSignal.timeout(58000)});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'Falha na conexão.');
    if(data.contexto)contexto=data.contexto;addMessage('assistant',data);$('#status').textContent='';success=true;
  }catch(e){
    $('#status').textContent=e.name==='TimeoutError'?'A resposta demorou demais. Tente novamente.':e.message;
    const retry=element('button','chip','Tentar novamente');retry.id='retry';retry.type='button';retry.addEventListener('click',()=>request(payload,null,state));$('#status').append(retry);
  }finally{if(!success)controls.forEach((control,i)=>control.disabled=previous[i]);busy=false;$('#send').disabled=false;$('#message').focus();}
}
function send(text){if(busy||!text.trim())return;$('#message').value='';return request({acao:'mensagem',texto:text},text);}
$('#form').addEventListener('submit',e=>{e.preventDefault();send($('#message').value)});
$('#message').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('#form').requestSubmit();}});
document.querySelectorAll('[data-prompt]').forEach(b=>b.addEventListener('click',()=>send(b.dataset.prompt)));
document.querySelectorAll('[data-simulation]').forEach(b=>b.addEventListener('click',()=>request({acao:'form',tipo:'banca'},b.textContent.replace(/↗/g,'').trim())));
const topics=element('button','demo','Explorar temas');topics.type='button';topics.addEventListener('click',()=>request({acao:'secao',secao:'inicio'},'Explorar temas'));$('header').append(topics);
$('#new').addEventListener('click',()=>{if(!busy)location.reload();});
$('#demo').addEventListener('click',()=>request({acao:'form',tipo:'banca'},'Explorar os gráficos da banca'));
