/* [R357] Proxies de MEDIO para todos los videos que no lo tengan. NO se guarda el proyecto: `proxyPath` no se
   serializa y la app reengancha los proxies por archivo hermano al abrir, asi que basta con crear los ficheros. */
import http from 'http';
const RUTA=process.argv[2];
/* La app abre varias ventanas (arranque + editor): hay que elegir la pagina donde vive `state`, no la primera. */
const lista=()=>new Promise((r2,rj)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',rj);});
const probar=async(u)=>{ const w=new WebSocket(u); try{ await new Promise((ok,mal)=>{w.onopen=ok;w.onerror=mal;setTimeout(()=>mal(new Error('t')),4000);}); }catch(e){ return null; }
  const res=await new Promise(ok=>{ w.onmessage=e=>{ const m=JSON.parse(e.data); if(m.id===1) ok(m); };
    w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:'typeof state!=="undefined" && !!state.media',returnByValue:true}}));
    setTimeout(()=>ok(null),5000); });
  if(res && res.result && res.result.result && res.result.result.value===true) return w;
  try{ w.close(); }catch(e){} return null; };
let ws=null;
for(let intento=0; intento<40 && !ws; intento++){
  const t=await lista();
  for(const pg of t.filter(x=>x.type==='page'&&x.webSocketDebuggerUrl)){ ws=await probar(pg.webSocketDebuggerUrl); if(ws)break; }
  if(!ws) await new Promise(r=>setTimeout(r,3000));
}
if(!ws){ console.log('no se encontro la ventana del editor'); process.exit(1); }
console.log('conectado a la ventana del editor');
let id=1,muerto=false;const p=new Map(); ws.onclose=()=>{muerto=true;};
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const to=(pr,ms)=>Promise.race([pr,new Promise((_,rj)=>setTimeout(()=>rj(new Error('TIMEOUT')),ms))]);
const ev=async(x,ms=300000)=>{const r=await to(cmd('Runtime.evaluate',{expression:x,awaitPromise:false,returnByValue:true}),ms);if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await ev(`state.dirty=false; openProjectPath(${JSON.stringify(RUTA)},true); 1`);
let ok=false;
for(let i=0;i<200;i++){ await wait(3000); if(muerto){console.log('renderer caido durante la carga');process.exit(1);}
  try{ const s=await ev('({n:state.media.length, cargando:state.media.filter(m=>m._loading).length, ruta:currentPath})');
    if(s.n>=800 && s.cargando===0){ ok=true; console.log('cargado:',JSON.stringify(s)); break; } }catch(e){}
}
if(!ok){ console.log('no cargo, se aborta'); process.exit(1); }
const n=await ev(`(function(){ const v=state.media.filter(m=>m.kind==='video'&&!m.proxyReady&&!m.missing);
  v.forEach(m=>enqProxy(m)); return v.length; })()`);
console.log('encolados: '+n+' videos');
let ult=-1, quieto=0;
for(let i=0;i<3000;i++){
  await wait(15000);
  if(muerto){ console.log('*** renderer caido durante la generacion ***'); break; }
  try{
    const s=await ev(`(function(){ const v=state.media.filter(m=>m.kind==='video');
      const act=v.find(m=>m._pxGen);
      return { listos:v.filter(m=>m.proxyReady).length, total:v.length, cola:proxyQ.length, ocupado:proxyBusy,
               actual:act?(act.name||'').slice(0,26):null, pct:act?(act.proxyPct||0):null }; })()`);
    if(s.listos!==ult){ ult=s.listos; quieto=0;
      console.log(`[${new Date().toISOString().slice(11,19)}] ${s.listos}/${s.total} · cola ${s.cola} · ${s.actual||'-'} ${s.pct!=null?s.pct+'%':''}`); }
    else { quieto++; if(!s.cola && !s.ocupado) break; if(quieto>60){ console.log('sin avance'); break; } }
    if(!s.cola && !s.ocupado && s.listos>=s.total) break;
  }catch(e){ console.log('sin respuesta'); }
}
try{ console.log('FIN:', JSON.stringify(await ev(`({ conProxy:state.media.filter(m=>m.kind==='video'&&m.proxyReady).length, videos:state.media.filter(m=>m.kind==='video').length })`))); }catch(e){}
console.log('(no se guarda el proyecto: los proxies se reenganchan solos por archivo hermano)');
process.exit(0);
