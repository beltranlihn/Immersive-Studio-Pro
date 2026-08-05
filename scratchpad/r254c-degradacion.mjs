/* [R254c] ¿Se degradan las exportaciones entre si dentro de una misma sesion?
   En el A/B de R254b la PRIMERA pasada sin bucle dio 131 ms/fotograma y las tres siguientes 590-621: nunca volvio.
   Si eso es real, a Beltran le importa mas que el coste del bucle, porque una jornada de export son muchos planos
   seguidos en la misma sesion.
   Metodo: LA MISMA exportacion, identica, repetida 6 veces sin tocar nada mas. Si sube sola, hay fuga. */
import http from 'http'; import fs from 'fs'; import path from 'path';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:900000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const VID='C:/Users/beltr/Desktop/Alma Digital Studio/Code/Alma Digital Portfolio/Asset/Reel Portfolio/Reel Portfolio.mp4';

await cmd('Page.enable'); await cmd('Page.reload',{ignoreCache:true}); await wait(3800);
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e))); return 1; })()`);
await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`); await wait(1200);
await ev(`window.__vid=function(ruta,nombre){ return new Promise(res=>{ const url=DSP.toFileURL(ruta); const v=document.createElement("video"); v.preload="metadata"; v.src=url;
  v.addEventListener("loadedmetadata",()=>{ const m={id:uid(),name:nombre,kind:"video",el:v,originalEl:v,srcUrl:url,tex:newTex(),w:v.videoWidth,h:v.videoHeight,dur:v.duration,fps:30,color:clipColorFor("video"),proxyReady:false,proxyPct:0,path:ruta,fsize:0,folder:null,missing:false,_loading:false};
    state.media.push(m); renderMedia(); res(+m.dur.toFixed(2)); }); v.addEventListener("error",()=>res(null)); }); };1`);
await ev(`__vid(${JSON.stringify(VID)},"reel.mp4")`);

const N=60, FPS=30, SEGS=N/FPS;
async function corre(i){
  const OUT=path.join(process.cwd(),'scratchpad','r254c-'+i+'.mp4');
  try{ fs.rmSync(OUT); }catch(e){}
  await ev(`(function(){ state.clips=[]; state.media=state.media.filter(m=>m.kind!=='nest');
    const V=state.media.find(m=>m.kind==='video'); const vl=state.lanes.findIndex(l=>l.kind==='video');
    const c=makeClip(V,vl,0); c.dur=${SEGS}; c.inP=4; state.clips.push(c);
    renderTimeline(); render(); return 1; })()`);
  const antes=await ev(`({ vinst:_vinst.size, medios:state.media.length, mem:(performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):null) })`);
  const t0=Date.now();
  await ev(`(async()=>{ const ui=ripProgress('degradacion','pasada ${i}',1); try{
      await runExport({codec:'h264', res:512, fps:${FPS}, bitrate:8, range:'clips', rangeT:[0,${SEGS}],
                       outW:512, outH:512, outPath:${JSON.stringify(OUT)}, silent:true, noAudio:true, job:ui.job});
      ui.close(); return 1; }catch(e){ try{ui.close();}catch(_){} return 0; } })()`);
  const ms=(Date.now()-t0)/N;
  const desp=await ev(`({ vinst:_vinst.size, mem:(performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):null), exporting, exq:_exportQuality, excd:_exCD })`);
  return { ms, antes, desp };
}

console.log('LA MISMA exportacion, 6 veces seguidas, sin tocar nada entre medias:\n');
console.log('pasada   ms/fotograma   instancias antes/despues   heap MB   banderas tras el export');
const serie=[];
for(let i=1;i<=6;i++){
  const r=await corre(i); serie.push(r.ms);
  console.log('  '+i+'        '+String(Math.round(r.ms)).padStart(5)+'          '
    +String(r.antes.vinst).padStart(2)+' / '+String(r.desp.vinst).padStart(2)+'                '
    +String(r.desp.mem).padStart(5)+'     exporting='+r.desp.exporting+' exQ='+r.desp.exq+' exCD='+r.desp.excd);
}
const p1=serie[0], ult=serie[serie.length-1];
console.log('\n   primera '+Math.round(p1)+' ms  ·  ultima '+Math.round(ult)+' ms  ·  factor x'+(ult/p1).toFixed(1));
console.log('   ' + (ult > p1*1.6
  ? 'SE DEGRADA: la misma exportacion tarda mas cada vez. Hay algo que no se libera entre pasadas.'
  : 'NO se degrada de forma consistente: la primera pasada era simplemente calentamiento.'));
console.log('\nerrs JS: '+JSON.stringify(await ev(`window.__errs.slice(0,5)`)));
ws.close();
