/* [AUDIT 2026-08] Abrir .isp legacy de verdad: v2 (.rdome) y v3 (.ise) por openProjectPath, más el caso BOM. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const SP='C:\\\\Users\\\\beltr\\\\Desktop\\\\Alma Digital Studio\\\\Projects\\\\Immersive Studio Pro\\\\scratchpad';
const out={};
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e)));
  window.__alerts=[]; if(!window.__alertHook){ window.__alertHook=1; const aa=window.appAlert; window.appAlert=function(msg,cb){ __alerts.push(String(msg)); if(cb)cb(); }; }
  return 1; })()`);

/* caso BOM: el archivo tal como lo deja un editor de Windows (UTF-8 con BOM) */
out.bom=await ev(`(async function(){ state.dirty=false; __alerts.length=0;
  await openProjectPath('${SP}\\\\aud2608-legacy-v2-bom.rdome');
  return { alerts:__alerts.slice(), currentPath:String(currentPath||'') }; })()`);
await wait(600);
console.log(JSON.stringify(out,null,1));
ws.close();
