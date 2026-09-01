/* [R355] Genera proxies de MEDIO para todos los videos del proyecto, por la cola oficial (`enqProxy`).
   Guardas: no se guarda si el proyecto no esta entero, si la ruta no es la esperada o si no se genero nada. */
import http from 'http';
const t=await new Promise((r2,rj)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',rj);});
const ws=new WebSocket(t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl).webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async(x,ms=300000)=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:false,returnByValue:true,timeout:ms});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const RUTA='/Users/vicentemanzano/Desktop/RITO DIGITAL MASTER/Film Rito Digital/Rito Dome/Rito Dome.isp';
const ESPERADOS=483, CLIPS=276;
await ev('window.__errs=[];addEventListener("error",e=>__errs.push(String(e.message||e).slice(0,140)));1');
// asegurar el proyecto cargado (si ya lo esta, no se reabre)
let st=await ev('({n:state.media.length, faltan:state.media.filter(m=>m.missing).length, ruta:(typeof currentPath!=="undefined")?currentPath:null})');
if(!(st.n>=ESPERADOS && st.ruta===RUTA)){
  await ev(`state.dirty=false; openProjectPath(${JSON.stringify(RUTA)},true); 1`);
  for(let i=0;i<60;i++){ st=await ev('({n:state.media.length, faltan:state.media.filter(m=>m.missing).length, ruta:currentPath})');
    if(st.n>=ESPERADOS && st.faltan===0 && st.ruta===RUTA) break; await wait(2000); }
}
if(!(st.n>=ESPERADOS && st.ruta===RUTA)){ console.log('NO cargado, se aborta:', JSON.stringify(st)); process.exit(1); }
console.log('proyecto listo:', JSON.stringify(st));
const total=await ev(`(function(){ const v=state.media.filter(m=>m.kind==='video'&&!m.proxyReady);
  v.forEach(m=>enqProxy(m)); return v.length; })()`);
console.log('encolados: '+total+' videos');
let ult=-1, quieto=0;
for(let i=0;i<4000;i++){
  await wait(15000);
  const s=await ev(`(function(){ const v=state.media.filter(m=>m.kind==='video');
    const listos=v.filter(m=>m.proxyReady).length;
    const act=v.find(m=>m._pxGen);
    return { listos, total:v.length, cola:proxyQ.length, ocupado:proxyBusy,
             actual:act?(act.name||'').slice(0,28):null, pct:act?(act.proxyPct||0):null }; })()`);
  if(s.listos!==ult){ ult=s.listos; quieto=0;
    console.log(`[${new Date().toISOString().slice(11,19)}] ${s.listos}/${s.total} listos · cola ${s.cola} · ${s.actual||'-'} ${s.pct!=null?s.pct+'%':''}`);
  } else if(!s.ocupado && !s.cola){ break; } else { quieto++; if(quieto>80){ console.log('sin avance, se corta'); break; } }
  if(s.listos>=s.total && !s.cola && !s.ocupado) break;
}
const fin=await ev(`({ listos:state.media.filter(m=>m.kind==='video'&&m.proxyReady).length,
  total:state.media.filter(m=>m.kind==='video').length, n:state.media.length,
  clips:(activeSeq()||{nestClips:[]}).nestClips.length, ruta:currentPath })`);
console.log('FIN generacion:', JSON.stringify(fin));
if(fin.n<ESPERADOS || fin.clips<CLIPS || fin.ruta!==RUTA || fin.listos===0){
  console.log('NO se guarda (guardas):', JSON.stringify(fin)); process.exit(1); }
await ev('(async function(){ await saveProject(false); return 1; })()', 600000);
await wait(4000);
console.log('GUARDADO:', JSON.stringify(await ev(`({ proxysDeMedio:state.media.filter(m=>m.proxyPath).length,
  proxysDeComposicion:state.media.filter(m=>m.ncPath).length, medios:state.media.length,
  errores:(window.__errs||[]).slice(0,4) })`)));
ws.close(); process.exit(0);
