import { normalize } from './lib/normalize.mjs';
const $ = s => document.querySelector(s);
const messages = $('#messages');
let sessionId = crypto.randomUUID();
let busy = false;
const currency = x => x.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
function element(tag, cls, text) { const e = document.createElement(tag); if(cls)e.className=cls; if(text!==undefined)e.textContent=text; return e; }
function svgElement(tag, attrs) { const e=document.createElementNS('http://www.w3.org/2000/svg',tag); for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v); return e; }
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
  box.append(element('div','text',data.mensagem));
  if(data.grafico)box.append(drawChart(data.grafico));
  else if(data.grafico_url){const img=element('img','chart-img');img.src=data.grafico_url;img.alt='Gráfico da simulação';img.loading='lazy';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>img.replaceWith(element('p','','Não foi possível carregar o gráfico.')));box.append(img);}
  if(data.metricas&&Object.keys(data.metricas).length){const metrics=element('div','metrics');for(const [k,v]of Object.entries(data.metricas)){const m=element('div','metric',k==='saldo_final_medio'?'Saldo final médio das trajetórias':'Valor esperado por aposta');m.append(element('strong','',k==='saldo_final_medio'?currency(v):`${v.toLocaleString('pt-BR')}%`));metrics.append(m);}box.append(metrics);}
  messages.append(box);messages.scrollTop=messages.scrollHeight;
}
async function send(text){if(busy||!text.trim())return;busy=true;$('#send').disabled=true;$('#status').textContent='Beto está pensando…';addMessage('user',{mensagem:text});$('#message').value='';
  try{const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,sessionId}),signal:AbortSignal.timeout(58000)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Falha na conexão.');addMessage('assistant',data);$('#status').textContent='';}
  catch(e){$('#status').textContent=e.name==='TimeoutError'?'A resposta demorou demais. Tente novamente.':e.message;}
  finally{busy=false;$('#send').disabled=false;$('#message').focus();}
}
$('#form').addEventListener('submit',e=>{e.preventDefault();send($('#message').value)});
$('#message').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('#form').requestSubmit();}});
document.querySelectorAll('[data-prompt]').forEach(b=>b.addEventListener('click',()=>send(b.dataset.prompt)));
$('#new').addEventListener('click',()=>{if(!busy)location.reload();});
$('#demo').addEventListener('click',()=>{
  if(busy)return;const colors=['#298574','#c69446','#7c74a9','#5c8fb8','#b57372'];const datasets=[],finais=[];
  for(let s=0;s<5;s++){let saldo=1000;const data=[saldo];for(let r=0;r<150;r++){if(saldo>=50)saldo+=Math.random()<.5?47.5:-50;data.push(saldo);}finais.push(saldo);datasets.push({label:`Simulação ${s+1}`,data,borderColor:colors[s]});}
  addMessage('assistant',normalize({mensagem:'Exemplo: banca inicial de R$ 1.000, aposta fixa de R$ 50, odd de 1,95 e probabilidade hipotética de acerto de 50%, em 150 apostas. Estas cinco trajetórias ilustram a variação possível; são poucas para estimar o risco com precisão. O valor esperado por aposta é −2,5% (−R$ 1,25). Cada trajetória para de apostar se não houver saldo suficiente, preservando o valor restante.',grafico:{data:{labels:Array.from({length:151},(_,i)=>i),datasets}},saldo_final_medio:finais.reduce((a,b)=>a+b,0)/5,valor_esperado_por_aposta_pct:-2.5}),true);
});
