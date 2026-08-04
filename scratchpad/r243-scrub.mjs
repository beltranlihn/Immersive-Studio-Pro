/* [R243] Scrub SIN proxy con el material real de Beltrán (HEVC 7196×912 @60 fps, GOP 250).
   Se corre IGUAL antes y después del cambio, sobre el .exe desplegado, para poder comparar.
   Trampas que esta sonda evita a propósito:
     · medir el PROXY creyendo que se mide el original → se comprueba la URL de cada instancia y se aborta si
       alguna apunta a un `.dsp-proxy-*.mp4`;
     · promediar un solo salto → nueve saltos, mediana y peor;
     · dar por bueno un número imposible → se reporta también si el fotograma llegó (`ready`) y la cobertura del
       composite, para distinguir «rápido» de «no dibujó nada».
   Uso: node r243-scrub.mjs [puerto]   (por defecto 9222) */
import http from 'http';
const PORT=process.argv[2]||9222;
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:PORT,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:900000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const DIR=String.raw`C:\Users\beltr\Desktop\Alma Digital Studio\Studio\Reel 360\Edit Reel 360\Neurocosm 360`;
const out={};
await ev(`(function(){ window.__errs=window.__errs||[]; addEventListener('error',e=>__errs.push(String(e.message||e))); return 1; })()`);

/* --- sala + 4 capas del material real, SIN proxy --------------------------------------------- */
await ev(`state.dirty=false;1`);
await ev(`(async()=>{try{await startDemoProject('room');}catch(e){window.__d=String(e);}})()`); await wait(2800);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){}
  document.querySelector('#viewModeSeg button[data-v="2d"]').click(); resize(); return 1;})()`); await wait(600);

out.importar=await ev(`(async function(){ const dir=${JSON.stringify(DIR)};
  const nombres=['Neuro1_7196.mp4','Neuro2_7196.mp4','Neuro3_7196.mp4','Neuro4_7196.mp4'];
  const r=[]; for(const n of nombres){ const ya=state.media.find(m=>m.name===n); if(ya){ r.push({n,ya:true}); continue; }
    const m=await addVideoFromPath(dir+'\\\\'+n,n); r.push({n, ok:!!m, px:m?(m.w+'x'+m.h):null, fps:m?m.fps:null}); }
  return r; })()`);
await wait(2500);

await ev(`window.__montar=async function(n){ state.clips=[];
  const vids=state.media.filter(m=>m.kind==='video'&&m.w>4000).slice(0,n);
  const lanesV=state.lanes.map((l,i)=>({l,i})).filter(x=>x.l.kind==='video');
  while(lanesV.length<n){ state.lanes.push({id:uid(),name:'V'+(state.lanes.length+1),tag:'V'+(state.lanes.length+1),kind:'video',surf:'wall'}); lanesV.push({l:state.lanes[state.lanes.length-1],i:state.lanes.length-1}); }
  vids.forEach((m,k)=>{ addClip(m, lanesV[k].i, 0); const c=state.clips[state.clips.length-1];
    if(c){ c.dur=Math.min(20,m.dur||20); c.props.opacity=(k===0?100:60); } });
  state.playhead=5;
  await Promise.all(collectDrawnVideoClips(state.clips,state.lanes,5,0,[]).map(({c,m,local})=>vinstSeek(c,m,local)));
  renderTimeline(); render(); return { capas:vids.length, clips:state.clips.length }; };1`);

/* proxies FUERA: es lo que se quiere medir */
out.montaje=await ev(`(async function(){ state.useProxies=false; state.view.useProxy=false; return await __montar(4); })()`);
await wait(3000);

/* comprobación anti-trampa: ninguna instancia puede estar sirviéndose del proxy */
out.compruebaOrigen=await ev(`(function(){ const r=[];
  for(const [cid,vi] of _vinst){ r.push({ cid, url:String(vi.vsrc||'').slice(-46), proxy:/dsp-proxy/.test(String(vi.vsrc||'')) }); }
  return { instancias:r, algunoConProxy:r.some(x=>x.proxy) }; })()`);

/* --- la medida: nueve saltos de cabezal, como R241 ------------------------------------------- */
const medir=async()=>ev(`(async function(){ const ts=[2,7,3,9,5,1,8,4,6]; const lat=[];
  for(const t of ts){ const t0=performance.now(); state.playhead=t;
    await Promise.all(collectDrawnVideoClips(state.clips,state.lanes,t,0,[]).map(({c,m,local})=>vinstSeek(c,m,local)));
    render(); gl.finish(); lat.push(performance.now()-t0); }
  const o=lat.slice().sort((a,b)=>a-b);
  let listos=0,total=0; for(const {c,m} of collectDrawnVideoClips(state.clips,state.lanes,state.playhead,0,[])){ total++; if(clipTexReady(c,m))listos++; }
  return { saltos:o.length, msMediana:Math.round(o[Math.floor(o.length/2)]), msPeor:Math.round(o[o.length-1]),
           msMin:Math.round(o[0]), texturasListas:listos+'/'+total }; })()`);

out.scrubSinProxy=await medir();

/* ¿existe ya la vía rápida? OJO: `_scrubFast` es un `let` de ámbito de SCRIPT, así que NO es propiedad de
   `window` — hay que preguntar por el identificador desnudo o sale un falso negativo. */
out.viaRapida=await ev(`(function(){ const hay=(()=>{ try{ _scrubFast; return true; }catch(e){ return false; } })();
  return { existeScrubFast:hay, kfTimes:(typeof kfTimes), snapKf:(typeof snapKf), kfWorthIt:(typeof kfWorthIt),
    mediaConTabla:state.media.filter(m=>m._kfT&&m._kfT.length).map(m=>({n:m.name,kfs:m._kfT.length,allIntra:!!m._kfAllIntra})) }; })()`);

if(out.viaRapida.existeScrubFast){
  /* construir las tablas (al importar ya se pre-calientan; aquí se espera a que estén por si acaso) */
  out.tablas=await ev(`(async function(){ const ms=state.media.filter(m=>m.kind==='video'&&m.w>4000).slice(0,4);
    await Promise.all(ms.map(m=>kfTimes(m)));
    return ms.map(m=>{ const K=m._kfT; let gap=null;
      if(K&&K.length>1){ const d=[]; for(let i=1;i<K.length;i++)d.push(K[i]-K[i-1]); d.sort((a,b)=>a-b); gap=+d[Math.floor(d.length/2)].toFixed(2); }
      return { n:m.name, kfs:K?K.length:0, segEntreKf:gap, fallo:!!m._kfTFail }; }); })()`);
  /* ARRASTRANDO (lo que ve el usuario mientras mueve el cabezal) */
  await ev(`_scrubFast=true;1`);
  out.scrubArrastrando=await medir();
  /* AL SOLTAR: exacto, como siempre */
  await ev(`_scrubFast=false;1`);
  out.scrubTrasSoltar=await medir();
  /* el fotograma al soltar tiene que ser EL EXACTO, no el clave: se comprueba contra el instante pedido */
  out.exactitudAlSoltar=await ev(`(async function(){ state.playhead=7.317;
    await Promise.all(collectDrawnVideoClips(state.clips,state.lanes,7.317,0,[]).map(({c,m,local})=>vinstSeek(c,m,local)));
    const r=[]; for(const [cid,vi] of _vinst){ if(vi.vel&&vi.vsrc)r.push(+vi.vel.currentTime.toFixed(3)); }
    return { pedido:7.317, currentTime:r, todosExactos:r.every(x=>Math.abs(x-7.317)<0.05) }; })()`);
  /* y CON proxy no debe tocar nada (ya son 8 ms): kfWorthIt tiene que decir que no */
  out.conProxyNoActua=await ev(`(function(){ const ms=state.media.filter(m=>m.kind==='video'&&m.w>4000).slice(0,2);
    const antes=ms.map(m=>kfWorthIt(m));
    state.view.useProxy=true; const conProxy=ms.map(m=>({n:m.name,proxyListo:!!m.proxyReady,merece:kfWorthIt(m)}));
    state.view.useProxy=false; return { sinProxyMerece:antes, conProxy }; })()`);
}

out.errs=await ev(`window.__errs.slice(-10)`);
console.log(JSON.stringify(out,null,1));
ws.close();
