export function normalize(input) {
  let value = input;
  for (let i = 0; i < 6; i++) {
    if (Array.isArray(value)) { value = value[0]; continue; }
    if (typeof value === 'string') {
      try { value = JSON.parse(value.replace(/^```(?:json)?\s*|\s*```$/g, '')); continue; }
      catch { return { mensagem: value }; }
    }
    if (!value || typeof value !== 'object') throw new Error('Resposta vazia do n8n.');
    if (value.mensagem || value.texto || value.grafico_url || value.grafico || value.chart || value.formulario || value.botoes) break;
    if (value.resposta !== undefined) { value = value.resposta; continue; }
    if (value.output !== undefined) { value = value.output; continue; }
    if (value.json !== undefined) { value = value.json; continue; }
    break;
  }
  if (!value || typeof value !== 'object') throw new Error('Formato de resposta inválido.');
  const result = { mensagem: typeof value.mensagem === 'string' ? value.mensagem : typeof value.texto === 'string' ? value.texto : typeof value.text === 'string' ? value.text : 'Escolha uma das opções para continuar.' };
  // Keep the workflow's navigation and conversation state; the browser renders text only.
  for (const key of ['contexto', 'secao', 'trilha', 'formulario', 'acoes', 'acoesTitulo', 'botoes', 'resultado']) {
    if (value[key] !== undefined) result[key] = value[key];
  }
  if (typeof value.grafico_url === 'string') {
    try {
      const url = new URL(value.grafico_url);
      if (url.protocol === 'https:' && url.username === '' && url.password === '') result.grafico_url = url.href;
    } catch {}
  }
  let chart = value.grafico || value.chart;
  const visual = value.resultado?.visual?.grafico;
  if (!chart && Array.isArray(visual?.indices) && Array.isArray(visual.series)) {
    const colors = ['#298574','#c69446','#7c74a9','#5c8fb8','#b57372','#234b3c'];
    chart = { data: { labels: visual.indices, datasets: visual.series.map((s,i) => ({ label:s.nome, data:s.valores, borderColor:colors[i % colors.length] })) } };
  }
  if (!chart && result.grafico_url) {
    try { chart = JSON.parse(new URL(result.grafico_url).searchParams.get('c')); } catch {}
  }
  if (chart?.data?.labels && Array.isArray(chart.data.datasets)) {
    const labels = chart.data.labels;
    const datasets = chart.data.datasets;
    if (Array.isArray(labels) && labels.length > 0 && labels.length <= 5001 && datasets.length > 0 && datasets.length <= 12 && datasets.every(d => d && Array.isArray(d.data) && d.data.length === labels.length && d.data.every(Number.isFinite))) {
      result.grafico = { data: { labels: labels.map(x => String(x).slice(0, 60)), datasets: datasets.map(d => ({ label: String(d.label || 'Cenário').slice(0, 80), data: d.data, borderColor: /^#[0-9a-f]{6}$/i.test(d.borderColor) ? d.borderColor : '#2e907a' })) } };
    }
  }
  result.metricas = {};
  for (const key of ['saldo_final_medio','valor_esperado_por_aposta_pct']) {
    if (Number.isFinite(value[key])) result.metricas[key] = value[key];
  }
  return result;
}
