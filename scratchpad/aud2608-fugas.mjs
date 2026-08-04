/* [AUDIT 2026-08] Fugas de recursos en el cambio de proyecto.
   Hipótesis (leída en el código): loadProject NO hace disposeMedia de los medios del proyecto anterior
   (newProject sí). Se cuentan texturas GL vivas y object-URLs a lo largo de ciclos demo→abrir proyecto. */
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
await ev(`(function(){ window.__errs=window.__errs||[];
  if(!window.__texCount){ window.__texCount={alive:0,made:0,freed:0}; const ct=gl.createTexture.bind(gl), dt=gl.deleteTexture.bind(gl);
    gl.createTexture=function(){ __texCount.alive++; __texCount.made++; return ct(); };
    gl.deleteTexture=function(x){ if(x)__texCount.alive--; __texCount.freed++; return dt(x); }; }
  if(!window.__urlCount){ window.__urlCount={alive:0}; const cu=URL.createObjectURL.bind(URL), ru=URL.revokeObjectURL.bind(URL);
    URL.createObjectURL=function(b){ __urlCount.alive++; return cu(b); };
    URL.revokeObjectURL=function(u){ __urlCount.alive--; return ru(u); }; }
  if(!window.__alertHook){ window.__alertHook=1; window.__alerts=[]; window.appAlert=function(msg,cb){ __alerts.push(String(msg)); if(cb)cb(); }; }
  return 1; })()`);

const medir=()=>ev(`(function(){ return { tex:__texCount.alive, urls:__urlCount.alive,
  vinst:(typeof _vinst!=='undefined')?_vinst.size:null, fxHist:(typeof _fxHist!=='undefined')?_fxHist.size:null,
  nestPool:(typeof _nestPool!=='undefined')?_nestPool.length:null, ra:(typeof _ra!=='undefined')?_ra.size:null,
  media:state.media.length, memMB:performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):null }; })()`);

/* ciclo: demo domo (crea medias con textura: formas/texto) → abrir proyecto vacío por loadProject */
const ciclos=[];
for(let i=0;i<4;i++){
  await ev(`state.dirty=false;1`);
  await ev(`(async()=>{try{await startDemoProject('dome');}catch(e){window.__d=String(e);}})()`); await wait(2200);
  await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){}return 1;})()`);
  const conDemo=await medir();
  await ev(`state.dirty=false;1`);
  await ev(`(async()=>{ await openProjectPath('${SP}\\\\aud2608-legacy-v2.rdome'); })()`); await wait(900);
  const trasLoad=await medir();
  ciclos.push({ i, conDemo, trasLoad });
}
out.ciclos=ciclos;
out.veredicto={ texTrasLoad:ciclos.map(c=>c.trasLoad.tex), urlsTrasLoad:ciclos.map(c=>c.trasLoad.urls) };
await ev(`state.dirty=false;1`);
await ev(`(async()=>{ await newProject('dome',4096,4096,60,180,true); })()`);
out.errs=await ev(`(window.__errs||[]).slice(0,10)`);
console.log(JSON.stringify(out,null,1));
ws.close();
