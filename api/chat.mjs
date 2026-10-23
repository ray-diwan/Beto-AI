import { normalize } from '../lib/normalize.mjs';
import { workflowRequest } from '../lib/request.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const fail = (status, code, error) => {
    console.warn('beto_connection', { code, status });
    return res.status(status).json({ code, error });
  };
  if (req.method !== 'POST') return fail(405, 'METHOD', 'Método não permitido.');
  if (req.headers.origin) {
    try {
      if (new URL(req.headers.origin).host !== req.headers.host) return fail(403, 'ORIGIN', 'Origem inválida. Abra o site pelo endereço do deploy.');
    } catch { return fail(403, 'ORIGIN', 'Origem inválida.'); }
  }
  const configuredUrl = process.env.N8N_WEBHOOK_URL?.trim();
  if (!configuredUrl) return fail(503, 'N8N_NOT_CONFIGURED', 'Configure N8N_WEBHOOK_URL em Production e faça um novo deploy.');
  let url;
  try {
    url = new URL(configuredUrl);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
  } catch { return fail(503, 'N8N_INVALID_URL', 'N8N_WEBHOOK_URL precisa conter uma URL HTTPS válida, sem aspas.'); }
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return fail(400, 'INVALID_INPUT', 'Mensagem em formato inválido.'); }
  let payload;
  try { payload = workflowRequest(body); }
  catch (error) { return fail(400, 'INVALID_INPUT', error.message); }
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (process.env.N8N_WEBHOOK_TOKEN?.trim()) headers.Authorization = `Bearer ${process.env.N8N_WEBHOOK_TOKEN.trim()}`;
    const upstream = await fetch(url, {
      method: 'POST', headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(50000), redirect: 'error'
    });
    if (upstream.status === 404) return fail(502, 'N8N_NOT_FOUND', 'n8n retornou 404: confira a Production URL, o método POST e se o workflow está ativo/publicado.');
    if ([401,403].includes(upstream.status)) return fail(502, 'N8N_AUTH', 'n8n recusou a autenticação. Confira a autenticação do webhook e N8N_WEBHOOK_TOKEN.');
    if (upstream.status === 405) return fail(502, 'N8N_METHOD', 'O webhook não aceita POST. Confira o método no nó de entrada do n8n.');
    if (!upstream.ok) return fail(502, 'N8N_EXECUTION', `n8n retornou HTTP ${upstream.status}. Abra Executions no n8n para conferir o erro do workflow.`);
    const raw = await upstream.text();
    if (!raw.trim()) return fail(502, 'N8N_EMPTY', 'O n8n respondeu sem conteúdo. Configure o workflow para devolver a resposta final do agente.');
    if (raw.length > 2000000) return fail(502, 'N8N_TOO_LARGE', 'O resultado excedeu o tamanho permitido. Retorne um resumo e apenas os pontos necessários ao gráfico.');
    if (/^\s*<(?:!doctype|html)/i.test(raw)) return fail(502, 'N8N_HTML', 'O endereço retornou uma página HTML. Confira se a variável contém a URL do webhook, não a página do workflow.');
    try {
      const value = JSON.parse(raw);
      if (['Workflow was started', 'Workflow got started'].includes(value?.message)) return fail(502, 'N8N_ACK_ONLY', 'O webhook confirmou o início, mas não devolveu a resposta do Beto. Configure a resposta após o agente.');
    } catch {}
    try { return res.status(200).json(normalize(raw)); }
    catch { return fail(502, 'N8N_RESPONSE', 'A resposta do n8n está em formato incompatível. Retorne um objeto com output ou mensagem.'); }
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') return fail(504, 'N8N_TIMEOUT', 'O n8n demorou mais de 50 segundos. Confira a execução, o modelo e as ferramentas do agente.');
    return fail(502, 'N8N_UNREACHABLE', 'Não foi possível conectar ao n8n. Confira o endereço HTTPS e a disponibilidade do serviço.');
  }
}

