import http from 'http'; import fs from 'fs';
const port=9222;
function targets(){ return new Promise((res,rej)=>{ http.get({host:'127.0.0.1',port,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b));}catch(e){rej(e);}});}).on('error',rej); }); }
export const SHOTS='C:/Users/beltr/AppData/Local/Temp/claude/C--Users-beltr-Desktop-Alma-Digital-Studio-Projects-Immersive-Studio-Pro/f0de9ad5-8bdc-480b-8a2f-b96e2600a726/scratchpad/r227/';
export async function connect(){
  try{ fs.mkdirSync(SHOTS,{recursive:true}); }catch(_){}
  const list=await targets();
  const page=list.find(t=>t.type==='page'&&t.webSocketDebuggerUrl);
  if(!page) throw new Error('no page target');
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ ws.onopen=res; ws.onerror=()=>rej(new Error('ws fail')); });
  let id=0; const pend=new Map();
  ws.onmessage=ev=>{ const m=JSON.parse(ev.data); if(m.id&&pend.has(m.id)){ pend.get(m.id)(m); pend.delete(m.id); } };
  const cmd=(method,params={})=>new Promise((res,rej)=>{ const i=++id; pend.set(i,m=>m.error?rej(new Error(JSON.stringify(m.error))):res(m.result)); ws.send(JSON.stringify({id:i,method,params})); });
  const evalExpr=async(expr)=>{ const r=await cmd('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true,timeout:60000}); if(r.exceptionDetails)throw new Error('page threw: '+(r.exceptionDetails.exception?.description||r.exceptionDetails.text)); return r.result.value; };
  const shot=async(name)=>{ const {data}=await cmd('Page.captureScreenshot',{format:'png'}); const p=SHOTS+name; fs.writeFileSync(p,Buffer.from(data,'base64')); return p; };
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  await evalExpr(`(function(){ if(window.__errs)return 'already';
    window.__errs=[]; window.addEventListener('error',e=>window.__errs.push(String(e.message||e)));
    window.addEventListener('unhandledrejection',e=>window.__errs.push('rej: '+String((e.reason&&e.reason.message)||e.reason)));
    const ce=console.error; console.error=function(){ try{window.__errs.push('console: '+[...arguments].map(String).join(' '));}catch(_){} return ce.apply(console,arguments); };
    return 'hooked'; })()`);
  return { ws, cmd, evalExpr, shot, wait };
}
