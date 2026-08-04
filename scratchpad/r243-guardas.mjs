/* [R243] Las guardas del scrub rápido — lo que impide que el atajo se cuele donde haría daño.
   La sonda anterior NO llegó a ejercer la compuerta del proxy (los medios recién importados no tenían proxy
   enganchado, así que `kfWorthIt` decía «sí» con razón). Aquí se falsea un proxy listo para probarla de verdad. */
import http from 'http';
const PORT=process.argv[2]||9222;
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:PORT,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:600000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const out={};

/* 1 · CON PROXY EN USO no debe actuar (ya son 8 ms; snapear sería empeorar la imagen sin ganar nada) */
out['1_compuertaProxy']=await ev(`(function(){ const m=state.media.find(x=>x.kind==='video'&&x.w>4000); if(!m)return {salta:'sin medio'};
  const bakR=m.proxyReady, bakU=m.proxyUrl, bakV=state.view.useProxy;
  const r={};
  state.view.useProxy=false; m.proxyReady=false; m.proxyUrl=null;   r.sinProxy=kfWorthIt(m);
  m.proxyReady=true; m.proxyUrl='blob:falso-proxy'; state.view.useProxy=true; r.conProxyEnUso=kfWorthIt(m);
  state.view.useProxy=false;                                        r.conProxyPeroDesactivado=kfWorthIt(m);
  m.proxyReady=bakR; m.proxyUrl=bakU; state.view.useProxy=bakV;
  return r; })()`);

/* 2 · EXPORT: aunque la bandera quedara encendida, `exporting` manda y el fotograma es el exacto */
out['2_export']=await ev(`(async function(){ const m=state.media.find(x=>x.kind==='video'&&x.w>4000);
  const c=state.clips[0]; if(!m||!c)return {salta:'sin material'};
  _scrubFast=true; exporting=true;
  await vinstSeek(c,m,7.317);
  const vi=_vinst.get(c.id); const ct=vi&&vi.vel?+vi.vel.currentTime.toFixed(3):null;
  exporting=false; _scrubFast=false;
  return { pedido:7.317, currentTime:ct, exactoPeseAlaBandera:(ct!=null&&Math.abs(ct-7.317)<0.05) }; })()`);

/* 3 · MEDIO LIGERO (poca resolución): no merece la pena ni leer el moov */
out['3_medioLigero']=await ev(`(function(){ const falso={kind:'video',path:'C:/x.mp4',w:1280,h:720,srcUrl:'blob:x'};
  const grande={kind:'video',path:'C:/y.mp4',w:7196,h:912,srcUrl:'blob:y'};
  return { ligero720p:kfWorthIt(falso), tira7196:kfWorthIt(grande) }; })()`);

/* 4 · UNA sola capa: cuánto cuesta el arrastre en el caso corriente */
out['4_unaCapa']=await ev(`(async function(){
  const todos=state.clips.slice(); state.clips=todos.slice(0,1); render();
  const medir=async()=>{ const ts=[2,7,3,9,5,1,8,4,6]; const lat=[];
    for(const t of ts){ const t0=performance.now(); state.playhead=t;
      await Promise.all(collectDrawnVideoClips(state.clips,state.lanes,t,0,[]).map(({c,m,local})=>vinstSeek(c,m,local)));
      render(); gl.finish(); lat.push(performance.now()-t0); }
    const o=lat.sort((a,b)=>a-b); return { mediana:Math.round(o[4]), peor:Math.round(o[8]) }; };
  _scrubFast=false; const exacto=await medir();
  _scrubFast=true;  const rapido=await medir();
  _scrubFast=false; state.clips=todos; render();
  return { exacto, rapido, ganancia:+(exacto.mediana/Math.max(1,rapido.mediana)).toFixed(1) }; })()`);

/* 5 · la red de seguridad: un pointerup de ventana apaga la bandera pase lo que pase */
out['5_redDeSeguridad']=await ev(`(async function(){ _scrubFast=true;
  window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));
  await new Promise(r=>setTimeout(r,120));
  return { trasPointerup:_scrubFast===false }; })()`);

/* 6 · ¿detectFps acertó al importar por ruta? (observación: los 9 clips son 60p) */
out['6_fpsImportado']=await ev(`(function(){ return state.media.filter(m=>m.kind==='video'&&m.w>4000).map(m=>({n:m.name,fps:m.fps})); })()`);

out.errs=await ev(`(window.__errs||[]).slice(-10)`);
console.log(JSON.stringify(out,null,1));
ws.close();
