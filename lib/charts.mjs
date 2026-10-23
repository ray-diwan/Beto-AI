export function validGraph(g) {
  if(!g||!['linha','barras','faixa'].includes(g.tipo)||!['BRL','percentual','numero'].includes(g.unidade))return false;
  if(!Array.isArray(g.labels)||g.labels.length<1||g.labels.length>150||!Array.isArray(g.series)||g.series.length<1||g.series.length>8)return false;
  const values=v=>Array.isArray(v)&&v.length===g.labels.length&&v.every(Number.isFinite);
  if(!g.series.every(s=>s&&values(s.valores)))return false;
  return g.tipo!=='faixa'||(g.faixa&&values(g.faixa.inferior)&&values(g.faixa.superior)&&g.faixa.inferior.every((v,i)=>v<=g.faixa.superior[i]));
}
const color=c=>/^#[0-9a-f]{6}$/i.test(c)?c:'#298574';
const number=v=>v.toLocaleString('pt-BR',{maximumFractionDigits:2});
export function renderGraph(g) {
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const svgEl=(tag,attrs)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
  const box=el('div','chart-card');
  if(!validGraph(g)){box.append(el('p','','Os dados deste gráfico estão incompletos.'));return box;}
  const fmt=v=>g.unidade==='BRL'?v.toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:2}):number(v)+(g.unidade==='percentual'?'%':'');
  box.append(el('h3','',g.titulo||'Resultados'),el('p','chart-note',g.nota||''));
  const w=760,h=340,left=82,right=20,top=20,bottom=g.tipo==='barras'?88:45, n=g.labels.length;
  let min=0,max=g.unidade==='percentual'?100:1;
  const include=v=>{for(const x of v){min=Math.min(min,x);max=Math.max(max,x);}};
  for(const s of g.series)include(s.valores);
  if(g.faixa){include(g.faixa.inferior);include(g.faixa.superior);}
  const pad=(max-min)*.06||1;if(g.unidade!=='percentual'){max+=pad;if(min<0)min-=pad;}
  const plot=w-left-right,x=i=>g.tipo==='barras'?left+(i+.5)*plot/n:left+i*plot/Math.max(1,n-1),y=v=>h-bottom-(v-min)*(h-top-bottom)/(max-min);
  const svg=svgEl('svg',{viewBox:`0 0 ${w} ${h}`,role:'img','aria-label':`${g.titulo}. ${g.eixoX}: ${g.eixoY}.`});
  for(let k=0;k<=4;k++){
    const value=min+(max-min)*k/4,yy=y(value);
    svg.append(svgEl('line',{x1:left,x2:w-right,y1:yy,y2:yy,stroke:'#e3e8df'}));
    const t=svgEl('text',{x:left-8,y:yy+4,'text-anchor':'end',fill:'#596e59','font-size':11});t.textContent=number(value);svg.append(t);
  }
  if(g.faixa){const points=g.faixa.superior.map((v,i)=>`${x(i)},${y(v)}`).concat(g.faixa.inferior.map((v,i)=>`${x(i)},${y(v)}`).reverse()).join(' ');svg.append(svgEl('polygon',{points,fill:color(g.faixa.cor),'fill-opacity':.17}));}
  const bars=g.series.filter(s=>!s.tracejado).length;
  let barIndex=0;
  for(const s of g.series){
    if(g.tipo==='barras'&&!s.tracejado){
      const bw=plot/n*.75/Math.max(1,bars);
      s.valores.forEach((v,i)=>{const b=svgEl('rect',{x:x(i)-bars*bw/2+barIndex*bw,y:Math.min(y(0),y(v)),width:Math.max(.2,bw-1),height:Math.abs(y(v)-y(0)),fill:color(s.cor)});const title=svgEl('title',{});title.textContent=`${g.labels[i]} — ${s.nome}: ${fmt(v)}`;b.append(title);svg.append(b);});barIndex++;
    }else{
      const path=svgEl('polyline',{points:s.valores.map((v,i)=>`${x(i)},${y(v)}`).join(' '),fill:'none',stroke:color(s.cor),'stroke-width':2,'stroke-dasharray':s.tracejado?'6 4':'none'});svg.append(path);
      if(n===1)svg.append(svgEl('circle',{cx:x(0),cy:y(s.valores[0]),r:3,fill:color(s.cor)}));
    }
  }
  const ticks=[...new Set(Array.from({length:Math.min(5,n)},(_,k)=>Math.round((n-1)*k/Math.max(1,Math.min(5,n)-1))))];
  for(const i of ticks){const t=svgEl('text',{x:x(i),y:h-bottom+20,'text-anchor':'middle',fill:'#596e59','font-size':10});const label=String(g.labels[i]);t.textContent=label.length>24?label.slice(0,21)+'…':label;svg.append(t);}
  box.append(svg,el('p','legend',`Horizontal: ${g.eixoX} · Vertical: ${g.eixoY}`));
  const legend=el('div','legend');for(const s of g.series){const item=el('span','',s.nome),dot=el('i');dot.style.backgroundColor=color(s.cor);item.prepend(dot);legend.append(item);}if(g.faixa)legend.append(el('span','','Faixa sombreada: percentis 10–90'));box.append(legend);
  const readout=el('p','chart-readout','Passe o cursor para consultar os valores.');
  svg.addEventListener('pointermove',event=>{const pt=svg.createSVGPoint();pt.x=event.clientX;pt.y=event.clientY;const matrix=svg.getScreenCTM();if(!matrix)return;const local=pt.matrixTransform(matrix.inverse());const i=Math.max(0,Math.min(n-1,Math.round((local.x-left)/plot*(g.tipo==='barras'?n:n-1)-(g.tipo==='barras'?.5:0))));readout.textContent=`${g.labels[i]} · `+g.series.map(s=>`${s.nome}: ${fmt(s.valores[i])}`).join(' · ')+(g.faixa?` · P10: ${fmt(g.faixa.inferior[i])} · P90: ${fmt(g.faixa.superior[i])}`:'');});
  box.append(readout);
  const details=el('details'),summary=el('summary','','Consultar valores em tabela'),table=el('table'),caption=el('caption','',g.titulo),head=el('tr');
  table.append(caption);for(const label of [g.eixoX,...g.series.map(s=>s.nome),...(g.faixa?['Percentil 10','Percentil 90']:[])]){const th=el('th','',label);th.scope='col';head.append(th);}const thead=el('thead');thead.append(head);table.append(thead);
  const body=el('tbody');for(let i=0;i<n;i++){const row=el('tr');for(const v of [String(g.labels[i]),...g.series.map(s=>fmt(s.valores[i])),...(g.faixa?[fmt(g.faixa.inferior[i]),fmt(g.faixa.superior[i])]:[])])row.append(el('td','',v));body.append(row);}table.append(body);details.append(summary,table);box.append(details);
  return box;
}
export function renderGraphExplorer(graphs) {
  const valid=Array.isArray(graphs)?graphs.filter(validGraph).slice(0,10):[];
  const box=document.createElement('section');box.className='graph-explorer';box.setAttribute('aria-label','Explorar os resultados');
  if(!valid.length)return box;
  const title=document.createElement('h3');title.textContent='Explore os resultados';
  const nav=document.createElement('div');nav.className='chart-tabs';nav.setAttribute('role','group');nav.setAttribute('aria-label','Escolha um gráfico');
  const content=document.createElement('div');content.className='chart-panel';content.setAttribute('aria-live','polite');
  const labels={evolucao:'Trajetórias',distribuicao:'Como terminaram?',risco:'Risco de parar','faixa-0':'Faixa de resultados','faixa-1':'Faixa B',oportunidade:'E se eu guardasse?',convergencia:'Média e valor esperado',fluxos:'Prêmio × lucro',sequencias:'Sequências de perdas',dobrar:'Dobrar após perder'};
  valid.forEach((g,i)=>{const button=document.createElement('button');button.type='button';button.className='chip';button.textContent=labels[g.id]||g.titulo;button.setAttribute('aria-pressed',String(i===0));button.addEventListener('click',()=>{for(const b of nav.children)b.setAttribute('aria-pressed',String(b===button));content.replaceChildren(renderGraph(g));});nav.append(button);});
  content.append(renderGraph(valid[0]));box.append(title,nav,content);return box;
}
