/* [R240b] El zoom al abrir un proyecto: acotado si viene fuera de rango, y al VALOR DE FÁBRICA si no viene.
   Lo segundo es la misma familia de defecto que el encuadre horizontal de R239 — heredar estado del proyecto
   anterior. Además confirma que la app ARRANCA (la constante nueva se declara después de `state`: si se hubiera
   usado ahí, sería TDZ y no habría ni ventana). */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:120000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out={};
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e)));
 if(!window.__errHook){ window.__errHook=1; const ce=console.error; console.error=function(){try{__errs.push('con: '+[...arguments].map(String).join(' '));}catch(_){}return ce.apply(console,arguments);}; }
 return 1; })()`);
out.arranca=await ev(`({ hayState:typeof state==='object', ppsInicial:state.tl.pxPerSec, TL_PPS_DEF, TL_PPS_MIN, TL_PPS_MAX })`);
await ev(`state.dirty=false;1`);
await ev(`(async()=>{try{await startDemoProject('dome');}catch(e){window.__d=String(e);}})()`); await wait(2600);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){} return 1;})()`); await wait(600);

out.casos=await ev(`(function(){ const base=JSON.parse(JSON.stringify(serProject())); const r={};
  const abrir=(mut,et)=>{ const o=JSON.parse(JSON.stringify(base)); mut(o);
    state.tl.pxPerSec=777;                    // zoom "del proyecto anterior", bien lejos del de fábrica
    let err=null; try{ loadProject(o); }catch(e){ err=String(e.message||e); }
    return {pps:state.tl.pxPerSec, err}; };
  r.sinZoomGuardado   = abrir(o=>{ delete o.tl.pxPerSec; });
  r.zoomAbsurdoAlto   = abrir(o=>{ o.tl.pxPerSec=1e7; });
  r.zoomAbsurdoBajo   = abrir(o=>{ o.tl.pxPerSec=1e-9; });
  r.zoomNegativo      = abrir(o=>{ o.tl.pxPerSec=-40; });
  r.zoomNoNumerico    = abrir(o=>{ o.tl.pxPerSec='abc'; });
  r.sinBloqueTl       = abrir(o=>{ delete o.tl; });
  r.zoomSano          = abrir(o=>{ o.tl.pxPerSec=300; });
  r.correcto = r.sinZoomGuardado.pps===TL_PPS_DEF && r.zoomAbsurdoAlto.pps===TL_PPS_MAX
    && r.zoomAbsurdoBajo.pps===TL_PPS_MIN && r.zoomNegativo.pps===TL_PPS_DEF
    && r.zoomNoNumerico.pps===TL_PPS_DEF && r.zoomSano.pps===300;
  return r; })()`);
out.errs=await ev(`window.__errs.slice(0,15)`);
console.log(JSON.stringify(out,null,1));
ws.close();
