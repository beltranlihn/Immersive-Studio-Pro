import http from 'http'; import fs from 'fs';
const port=9222;
function targets(){ return new Promise((res,rej)=>{ http.get({host:'127.0.0.1',port,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b));}catch(e){rej(e);}});}).on('error',rej); }); }
export async function connect(){
  const list=await targets();
  const page=list.find(t=>t.type==='page'&&t.webSocketDebuggerUrl);
  if(!page) throw new Error('no page target');
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ ws.onopen=res; ws.onerror=()=>rej(new Error('ws fail')); });
  let id=0; const pend=new Map();
  ws.onmessage=ev=>{ const m=JSON.parse(ev.data); if(m.id&&pend.has(m.id)){ pend.get(m.id)(m); pend.delete(m.id); } };
  const cmd=(method,params={})=>new Promise((res,rej)=>{ const i=++id; pend.set(i,m=>m.error?rej(new Error(JSON.stringify(m.error))):res(m.result)); ws.send(JSON.stringify({id:i,method,params})); });
  const evalExpr=async(expr)=>{ const r=await cmd('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true,timeout:30000}); if(r.exceptionDetails)throw new Error('page threw: '+(r.exceptionDetails.exception?.description||r.exceptionDetails.text)); return r.result.value; };
  const shot=async(outPath)=>{ const {data}=await cmd('Page.captureScreenshot',{format:'png'}); fs.writeFileSync(outPath,Buffer.from(data,'base64')); return outPath; };
  return { ws, cmd, evalExpr, shot };
}
