/* [R258] ¿Compensa encender el cache de render-ahead (`_raOn`) por defecto con medios pesados?
   Lo unico que R243 no cubre es el RE-scrub sobre la misma zona: el primer toque ya baja a ~128 ms gracias al
   salto al fotograma clave, pero volver a pasar por donde ya se estuvo repite todo el trabajo.
   Metodo (el de R254, que es la mitad del hallazgo): A y B ALTERNADOS, repetidos, mediana, primera pasada
   descartada, y la diferencia solo se afirma si los rangos no se solapan.
   Material: los 4 HEVC 7196x912 reales, SIN proxy (se aborta si alguna instancia sirve un proxy). */
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

console.log('GPU: '+await ev(`(function(){const d=gl.getExtension('WEBGL_debug_renderer_info'); return d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):'?';})()`));
await ev(`(async()=>{try{await startDemoProject('room');}catch(e){}})()`); await wait(2800);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){}
  document.querySelector('#viewModeSeg button[data-v="2d"]').click(); resize(); return 1;})()`); await wait(600);
const imp=await ev(`(async function(){ const dir=${JSON.stringify(DIR)};
  const nombres=['Neuro1_7196.mp4','Neuro2_7196.mp4','Neuro3_7196.mp4','Neuro4_7196.mp4']; const r=[];
  for(const n of nombres){ const ya=state.media.find(m=>m.name===n); if(ya){ r.push(n+' (ya)'); continue; }
    const m=await addVideoFromPath(dir+'\\\\'+n,n); r.push(n+(m?' '+m.w+'x'+m.h:' FALLO')); }
  return r; })()`);
await wait(2500);
console.log('material: '+imp.join(' · '));

await ev(`window.__montar=async function(n){ state.clips=[];
  const vids=state.media.filter(m=>m.kind==='video'&&m.w>4000).slice(0,n);
  const lanesV=state.lanes.map((l,i)=>({l,i})).filter(x=>x.l.kind==='video');
  while(lanesV.length<n){ state.lanes.push({id:uid(),name:'V'+(state.lanes.length+1),tag:'V'+(state.lanes.length+1),kind:'video',surf:'wall'}); lanesV.push({l:state.lanes[state.lanes.length-1],i:state.lanes.length-1}); }
  vids.forEach((m,k)=>{ addClip(m, lanesV[k].i, 0); const c=state.clips[state.clips.length-1];
    if(c){ c.dur=Math.min(20,m.dur||20); c.props.opacity=(k===0?100:60); } });
  state.playhead=5;
  await Promise.all(collectDrawnVideoClips(state.clips,state.lanes,5,0,[]).map(({c,m,local})=>vinstSeek(c,m,local)));
  renderTimeline(); render(); return { capas:vids.length }; };1`);
await ev(`(async function(){ state.useProxies=false; state.view.useProxy=false; return await __montar(4); })()`);
await wait(3000);
const px=await ev(`(function(){ let n=0,pr=0; for(const [,vi] of _vinst){ n++; if(/dsp-proxy/.test(String(vi.vsrc||'')))pr++; } return {n,pr}; })()`);
if(px.pr){ console.log('*** ABORTADO: '+px.pr+' de '+px.n+' instancias sirven un PROXY, no el original'); ws.close(); process.exit(1); }
console.log('instancias sin proxy: '+px.n);

/* Una PASADA = recorrer la misma zona dos veces. La primera llena; la segunda es el re-scrub, que es lo que se
   mide. Con el cache apagado la segunda no tiene por que ser mas rapida; con el encendido, deberia serlo. */
await ev(`window.__pasada=async function(on){
  if(on){ _raOn=true; raInvalidate(); } else { _raOn=false; raReset(); }
  const ts=[3,3.5,4,4.5,5,5.5,6,6.5,7];
  const ir=async(t)=>{ state.playhead=t;
    await Promise.all(collectDrawnVideoClips(state.clips,state.lanes,t,0,[]).map(({c,m,local})=>vinstSeek(c,m,local)));
    render(); gl.finish(); };
  for(const t of ts) await ir(t);                       // 1a vuelta: llena
  const lat=[];
  for(const t of ts){ const t0=performance.now(); await ir(t); lat.push(performance.now()-t0); }   // 2a: se mide
  lat.sort((a,b)=>a-b);
  return { mediana:Math.round(lat[Math.floor(lat.length/2)]), min:Math.round(lat[0]), max:Math.round(lat[lat.length-1]),
           enCache:(function(){ let k=0; for(const t of ts) if(raHas(t))k++; return k+'/'+ts.length; })() }; };1`);

const A=[],B=[];
for(let i=0;i<4;i++){
  const a=await ev(`__pasada(false)`); const b=await ev(`__pasada(true)`);
  A.push(a); B.push(b);
  console.log('  vuelta '+(i+1)+'   apagado '+String(a.mediana).padStart(4)+' ms ('+a.min+'-'+a.max+')'
    +'   encendido '+String(b.mediana).padStart(4)+' ms ('+b.min+'-'+b.max+')   en cache: '+b.enCache);
}
const med=x=>{const s=x.slice(1).map(v=>v.mediana).sort((u,v)=>u-v); return s[Math.floor(s.length/2)];};
const rango=x=>{const s=x.slice(1); return Math.min(...s.map(v=>v.min))+'-'+Math.max(...s.map(v=>v.max));};
console.log('\n(descartada la 1a vuelta)  APAGADO mediana '+med(A)+' ms, rango '+rango(A)
  +'   |   ENCENDIDO mediana '+med(B)+' ms, rango '+rango(B));
await ev(`_raOn=false; raReset(); 1`);
console.log('errs JS: '+JSON.stringify(await ev(`window.__errs?window.__errs.slice(0,3):[]`)));
ws.close();
