import { normalize } from '../lib/normalize.mjs';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({error:'Método não permitido.'});
  if (req.headers.origin) {
    try { if (new URL(req.headers.origin).host !== req.headers.host) return res.status(403).json({error:'Origem inválida.'}); }
    catch { return res.status(403).json({error:'Origem inválida.'}); }
  }
  if (!process.env.N8N_WEBHOOK_URL) return res.status(503).json({error:'A conexão com o Beto ainda não foi configurada. Experimente a demonstração.'});
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 6000 || !/^[a-zA-Z0-9-]{8,80}$/.test(body.sessionId || '')) return res.status(400).json({error:'Mensagem ou sessão inválida.'});
    const url = new URL(process.env.N8N_WEBHOOK_URL);
    if (url.protocol !== 'https:') throw new Error('Configuração inválida.');
    const headers = {'Content-Type':'application/json'};
    if (process.env.N8N_WEBHOOK_TOKEN) headers.Authorization = `Bearer ${process.env.N8N_WEBHOOK_TOKEN}`;
    const upstream = await fetch(url, {method:'POST', headers, body:JSON.stringify({chatInput:body.message.trim(), sessionId:body.sessionId, action:'sendMessage'}), signal:AbortSignal.timeout(50000), redirect:'error'});
    if (!upstream.ok) throw new Error('Upstream indisponível');
    const raw = await upstream.text();
    if (raw.length > 2000000) throw new Error('Resposta muito grande');
    return res.status(200).json(normalize(raw));
  } catch { return res.status(502).json({error:'Não foi possível obter a resposta do Beto. Tente novamente em instantes.'}); }
}
