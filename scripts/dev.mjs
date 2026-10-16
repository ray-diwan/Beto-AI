import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import handler from '../api/chat.mjs';
const root=path.resolve('.');
http.createServer(async(req,res)=>{
  res.status=code=>{res.statusCode=code;return res;};res.json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
  if(req.url==='/api/chat'){let body='';for await(const part of req){body+=part;if(body.length>20000)return res.status(413).json({error:'Mensagem grande demais.'});}try{req.body=JSON.parse(body)}catch{return res.status(400).json({error:'JSON inválido.'})}return handler(req,res);}
  const pathname=new URL(req.url,'http://localhost').pathname;
  const allowed=['/index.html','/styles.css','/app.mjs','/lib/normalize.mjs'];const name=pathname==='/'?'/index.html':pathname;
  if(!allowed.includes(name)){res.statusCode=404;return res.end('Not found');}
  try{res.setHeader('Content-Type',name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css':'application/javascript');res.end(await readFile(path.join(root,name)));}catch{res.statusCode=404;res.end();}
}).listen(3000,'127.0.0.1',()=>console.log('Beto: http://127.0.0.1:3000'));
