/* [R241·C] Medición fiable. `performance.now()` en Electron viene con granularidad reducida (los 0,00 ms de la
   primera pasada eran eso, no ausencia de trabajo: el diagnóstico mostró 4 decodificadores vivos y el composite
   al 99,6 % de cobertura). Se promedian CIENTOS de iteraciones para salir del ruido del reloj, y se separa el
   coste de GPU del de DECODIFICADO, que es donde se sospecha el cuello. */
import http from 'http';
const PORT=process.argv[2]||9223;
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:PORT,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:900000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out={};

/* GPU: N renders en bloque cronometrados de una sola vez → el reloj se reparte entre todos */
await ev(`window.__gpu=function(n){ n=n||400; render(); gl.finish();
  const t0=performance.now(); for(let i=0;i<n;i++)render(); gl.finish();
  return +((performance.now()-t0)/n).toFixed(3); };
window.__play2=function(seg){ seg=seg||5; return new Promise(res=>{ state.playhead=0;
  const dt=[]; let last=performance.now(), t0=last, raf=0;
  const tick=()=>{ const now=performance.now(); dt.push(now-last); last=now;
    if(now-t0<seg*1000){ raf=requestAnimationFrame(tick); return; }
    cancelAnimationFrame(raf); if(state.playing)pause();
    const o=dt.slice(3).sort((a,b)=>a-b); const med=o[Math.floor(o.length/2)]||0;
    res({ fotogramas:o.length, fpsMediana:+(1000/Math.max(0.01,med)).toFixed(1),
      msMediana:+med.toFixed(1), msP95:+(o[Math.floor(o.length*0.95)]||0).toFixed(1),
      tironesMayores33ms:o.filter(x=>x>33).length,
      avanzoElCabezal:+state.playhead.toFixed(2) }); };
  play(); raf=requestAnimationFrame(tick); }); };1`);

async function bloque(nombre,capas){
  await ev(`__montar(${capas})`); await wait(2500);
  const r={capas};
  r.gpuMsPorRender=await ev(`__gpu(400)`);
  r.reproduccion=await ev(`__play2(5)`);
  await wait(400);
  r.scrub=await ev(`(async function(){ const ts=[2,7,3,9,5,1,8,4,6]; const lat=[];
    for(const t of ts){ const t0=performance.now(); state.playhead=t;
      await Promise.all(collectDrawnVideoClips(state.clips,state.lanes,t,0,[]).map(({c,m,local})=>vinstSeek(c,m,local)));
      render(); gl.finish(); lat.push(performance.now()-t0); }
    const o=lat.slice().sort((a,b)=>a-b);
    return { saltos:o.length, msMediana:Math.round(o[Math.floor(o.length/2)]), msPeor:Math.round(o[o.length-1]) }; })()`);
  out[nombre]=r;
}
await bloque('D1_unaCapa',1);
await bloque('D2_dosCapas',2);
await bloque('D4_cuatroCapas',4);

/* el experimento que importa: proxies. Se generan para los 4 clips en uso y se repite la medida. */
out.E_proxies=await ev(`(async function(){ const vids=state.media.filter(m=>m.kind==='video'&&m.w>4000).slice(0,4);
  const t0=performance.now(); const antes=vids.map(v=>({n:v.name,listo:!!v.proxyReady}));
  for(const v of vids){ if(v.proxyReady)continue; v.proxyReady=false; v.proxyPct=0; v._pxGen=true; enqProxy(v); }
  /* esperar a que la cola termine (con techo de 12 min: son 4 clips de 7196×912 @60fps) */
  const lim=performance.now()+12*60*1000;
  while(performance.now()<lim){ await new Promise(r=>setTimeout(r,3000));
    if(vids.every(v=>v.proxyReady||v.missing))break; }
  return { msGenerar:Math.round(performance.now()-t0), antes,
    despues:vids.map(v=>({n:v.name,listo:!!v.proxyReady,pct:v.proxyPct})) }; })()`);

if(out.E_proxies && out.E_proxies.despues && out.E_proxies.despues.some(x=>x.listo)){
  await ev(`state.useProxies=true;1`);
  await bloque('F4_cuatroCapasConProxy',4);
}
out.errs=await ev(`window.__errs.slice(-10)`);
console.log(JSON.stringify(out,null,1));
ws.close();
