const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function workflowRequest(body) {
  if (!object(body) || !/^[a-zA-Z0-9-]{8,80}$/.test(body.sessionId || '')) throw Error('Sessão inválida.');
  if (JSON.stringify(body).length > 16000) throw Error('Dados grandes demais. Reinicie a conversa.');
  const acao = body.acao || 'mensagem';
  if (!['mensagem','secao','form','calc','simular'].includes(acao)) throw Error('Ação inválida.');
  const contexto = body.contexto === undefined ? {} : body.contexto;
  if (!object(contexto)) throw Error('Contexto inválido.');
  const result = { acao, contexto, sessionId:body.sessionId };
  if (acao === 'mensagem') {
    const texto = body.texto ?? body.message;
    if (typeof texto !== 'string' || !texto.trim() || texto.length > 500) throw Error('Escreva uma mensagem de até 500 caracteres.');
    // Legacy Chat Trigger fields remain compatible with the earlier workflow.
    Object.assign(result, { texto:texto.trim(), chatInput:texto.trim(), action:'sendMessage' });
  } else if (acao === 'secao') {
    if (typeof body.secao !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.secao)) throw Error('Tema inválido.');
    result.secao = body.secao;
  } else {
    if (typeof body.tipo !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(body.tipo)) throw Error('Calculadora inválida.');
    if (body.dados !== undefined && !object(body.dados)) throw Error('Valores inválidos.');
    result.tipo = body.tipo;
    result.dados = body.dados || {};
  }
  return result;
}
