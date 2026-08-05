/* [R254] ¿Donde se va el tiempo de una exportacion? El humo de R253e dio 1,08 s por fotograma a 512x512, cuando
   R189 midio 207 ms a 4096x4096 con 24 clips. Esa diferencia, en la direccion contraria al tamano, pide medirse.
   Metodo: el MISMO export en variantes que van sumando ingredientes, y se resta. 60 fotogramas cada una. */
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
console.log('GPU:', await ev(`(function(){const d=gl.getExtension('WEBGL_debug_renderer_info'); return d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):'?';})()`));
await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`); await wait(1200);

await ev(`window.__vid=function(ruta,nombre){ return new Promise(res=>{ const url=DSP.toFileURL(ruta); const v=document.createElement("video"); v.preload="metadata"; v.src=url;
  v.addEventListener("loadedmetadata",()=>{ const m={id:uid(),name:nombre,kind:"video",el:v,originalEl:v,srcUrl:url,tex:newTex(),w:v.videoWidth,h:v.videoHeight,dur:v.duration,fps:30,color:clipColorFor("video"),proxyReady:false,proxyPct:0,path:ruta,fsize:0,folder:null,missing:false,_loading:false};
    state.media.push(m); renderMedia(); res(+m.dur.toFixed(2)); }); v.addEventListener("error",()=>res(null)); }); };
window.__imgs=function(){ const out=[];
  for(const [n,c] of [['A','#7FD4FF'],['B','#FFB37F'],['C','#C8A2FF']]){
    const cv=document.createElement('canvas'); cv.width=cv.height=256; const x=cv.getContext('2d');
    x.fillStyle=c; x.fillRect(0,0,256,256);
    const m={id:uid(),kind:'image',name:n,el:cv,originalEl:cv,tex:newTex(),w:256,h:256,dur:20,fps:0,color:c,missing:false,_loading:false};
    upTex(m.tex,cv); try{m.thumb=cv.toDataURL();}catch(e){} state.media.push(m); out.push(m); }
  renderMedia(); return out; };1`);
const durVid=await ev(`__vid(${JSON.stringify(VID)},"reel.mp4")`);
console.log('video real: '+durVid+' s\n');

const N=60, FPS=30, SEGS=N/FPS;
async function variante(nombre, montaJS){
  const OUT=path.join(process.cwd(),'scratchpad','r254-'+nombre+'.mp4');
  try{ fs.rmSync(OUT); }catch(e){}
  const info=await ev(`(function(){ state.clips=[]; state.media=state.media.filter(m=>m.kind!=='nest');
    const V=state.media.find(m=>m.kind==='video'); const I=__imgs();
    const vl=state.lanes.map((l,i)=>({l,i})).filter(o=>o.l.kind==='video').map(o=>o.i);
    (${montaJS})(V,I,vl);
    renderTimeline(); render();
    return { clips:state.clips.length, nests:state.media.filter(m=>m.kind==='nest').length }; })()`);
  const t0=Date.now();
  const r=await ev(`(async()=>{ const ui=ripProgress('perfil','${nombre}',1); try{
      await runExport({codec:'h264', res:512, fps:${FPS}, bitrate:8, range:'clips', rangeT:[0,${SEGS}],
                       outW:512, outH:512, outPath:${JSON.stringify(OUT)}, silent:true, noAudio:true, job:ui.job});
      ui.close(); return {ok:1};
    }catch(e){ try{ui.close();}catch(_){} return {ok:0,err:String(e&&e.message||e)}; } })()`);
  const ms=Date.now()-t0;
  const kb=fs.existsSync(OUT)?Math.round(fs.statSync(OUT).size/1024):0;
  console.log(nombre.padEnd(26)+' '+String(info.clips).padStart(2)+' clips · '+info.nests+' nidos   '
    +String((ms/1000).toFixed(1)).padStart(6)+' s   '+String(Math.round(ms/N)).padStart(5)+' ms/fotograma   '+kb+' KB'
    +(r.ok?'':'   *** '+r.err+' ***'));
  return ms/N;
}

/* la PRIMERA pasada paga el arranque del encoder y las reservas; se corre y se tira, o contamina la base */
await variante('0-calentamiento', `(V,I,vl)=>{ const c=makeClip(I[0],vl[0],0); c.dur=${SEGS}; state.clips.push(c); }`);
console.log('   (esa se descarta: primera pasada, arranque del encoder y reservas)\n');
console.log('variante                     escenario            total   por fotograma');
console.log('-------------------------------------------------------------------------');
const a=await variante('1-vacio',      `(V,I,vl)=>{ const c=makeClip(I[0],vl[0],0); c.dur=${SEGS}; state.clips.push(c); }`);
const b=await variante('2-un-video',   `(V,I,vl)=>{ const c=makeClip(V,vl[0],0); c.dur=${SEGS}; c.inP=4; state.clips.push(c); }`);
const c=await variante('3-dos-videos', `(V,I,vl)=>{ for(let k=0;k<2;k++){ const c=makeClip(V,vl[k],0); c.dur=${SEGS}; c.inP=4+k*10; state.clips.push(c); } }`);
const d=await variante('4-solo-nido',  `(V,I,vl)=>{ state.playhead=0; state.selLane=null;
    createComposition({kind:'ring',mediaIds:I.map(m=>m.id),count:6,size:35,el:25});
    const nc=state.clips.find(x=>{const m=mediaById(x.mediaId);return m&&m.kind==='nest';}); if(nc){nc.start=0;nc.dur=${SEGS};} }`);
const e=await variante('5-nido-de-video',`(V,I,vl)=>{ state.playhead=0; state.selLane=null;
    createComposition({kind:'ring',mediaIds:[V.id],count:6,size:35,el:25});
    const nc=state.clips.find(x=>{const m=mediaById(x.mediaId);return m&&m.kind==='nest';}); if(nc){nc.start=0;nc.dur=${SEGS};} }`);
const f=await variante('6-flotar',     `(V,I,vl)=>{ const c=makeClip(I[0],vl[0],0); c.dur=${SEGS}; state.clips.push(c);
    state.selId=c.id; state.selIds=[c.id]; addAnimPreset(c,'float'); }`);

/* Un decodificador SECUENCIAL y un bucle corto se llevan mal por definicion: al envolver, el tiempo de fuente
   salta hacia atras y hay que reposicionarse. Esto mide cuanto cuesta esa vuelta. */
const g=await variante('7-bucle-corto', `(V,I,vl)=>{ const c=makeClip(V,vl[0],0); c.dur=${SEGS}; c.inP=4; state.clips.push(c);
    state.selId=c.id; state.selIds=[c.id]; toggleLoop(c); setLoopRange(c,0.4); c.dur=${SEGS}; }`);
const h=await variante('8-bucle-largo', `(V,I,vl)=>{ const c=makeClip(V,vl[0],0); c.dur=${SEGS}; c.inP=4; state.clips.push(c);
    state.selId=c.id; state.selIds=[c.id]; toggleLoop(c); setLoopRange(c,20); c.dur=${SEGS}; }`);

/* CONTROL de orden: las variantes corren siempre en la misma secuencia, asi que las ultimas podrian salir lentas
   por acumulacion (instancias, memoria) y no por su contenido. Se repite una TEMPRANA al final: si sale igual, el
   orden no sesga; si sale mucho peor, todo lo de abajo hay que releerlo. */
const b2=await variante('9-control-un-video', `(V,I,vl)=>{ const c=makeClip(V,vl[0],0); c.dur=${SEGS}; c.inP=4; state.clips.push(c); }`);
console.log('\ncontrol de orden: "un video" al principio '+Math.round(b)+' ms · repetido al final '+Math.round(b2)+' ms'
  +(Math.abs(b2-b)/Math.max(1,b)<0.25 ? '   (sin sesgo apreciable)' : '   *** EL ORDEN SESGA: releer lo de abajo ***'));

console.log('\nlectura por resta:');
console.log('   base (1 imagen)                 '+Math.round(a)+' ms/fotograma');
console.log('   + un video                      +'+Math.round(b-a)+'  (decodificar 1 clip de video)');
console.log('   + el segundo video              +'+Math.round(c-b)+'  (el 2o clip del MISMO archivo, otro instante)');
console.log('   nido de 6 imagenes              '+Math.round(d)+'   (+'+Math.round(d-a)+' sobre la base)');
console.log('   nido de 6 copias de un VIDEO    '+Math.round(e)+'   (+'+Math.round(e-d)+' sobre el nido de imagenes)');
console.log('   Flotar sobre una imagen         '+Math.round(f)+'   (+'+Math.round(f-a)+' sobre la base)');
console.log('   video en BUCLE de 0,4 s         '+Math.round(g)+'   (+'+Math.round(g-b)+' sobre el mismo video sin bucle)');
console.log('   video en BUCLE de 20 s          '+Math.round(h)+'   (no llega a envolver en '+SEGS+' s)');
console.log('\nerrs JS: '+JSON.stringify(await ev(`window.__errs.slice(0,5)`)));
ws.close();
