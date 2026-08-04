/* [R241] Prueba de ESTRÉS tipo show sobre el .exe desplegado (RTX), con el material real de Beltrán:
   sala 7196×912 · clips HEVC 7196×912 @60fps de hasta 410 Mbps.
   Fase A = su proyecto tal cual · Fase B = carga creciente de capas · Fase C = calidad de preview ·
   Fase D = scrub · Fase E = memoria/contexto. Mide, no opina. */
import http from 'http'; import fs from 'fs';
const PORT=process.argv[2]||9223;
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:PORT,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:300000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out={};

await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e)));
 addEventListener('unhandledrejection',e=>__errs.push('rej: '+String((e.reason&&e.reason.message)||e.reason)));
 if(!window.__errHook){ window.__errHook=1; const ce=console.error; console.error=function(){try{__errs.push('con: '+[...arguments].map(String).join(' '));}catch(_){}return ce.apply(console,arguments);}; }
 glc.addEventListener('webglcontextlost',()=>{__errs.push('CONTEXTO WEBGL PERDIDO');});
 return 1; })()`);

/* identidad de la máquina: sin esto los números no significan nada */
out.entorno=await ev(`(function(){ const d=gl.getExtension('WEBGL_debug_renderer_info');
  return { gpu:d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
    maxTex:gl.getParameter(gl.MAX_TEXTURE_SIZE), heapLimMB:performance.memory?Math.round(performance.memory.jsHeapSizeLimit/1048576):null }; })()`);

/* medidor común: N renders seguidos → ms/frame; y un tramo de reproducción real → fps */
await ev(`window.__mide=function(n){ n=n||30; render(); const t0=performance.now();
  for(let i=0;i<n;i++){ state.playhead=(state.playhead+1/60)%Math.max(1,duration()); render(); }
  gl.finish(); const ms=(performance.now()-t0)/n;
  return { msPorRender:+ms.toFixed(2), fpsTeorico:+(1000/Math.max(0.01,ms)).toFixed(1) }; };
window.__play=async function(seg){ seg=seg||3; state.playhead=0; const f0=[]; let raf=0, t0=performance.now(), last=t0, n=0;
  return await new Promise(res=>{ const tick=()=>{ const now=performance.now(); f0.push(now-last); last=now; n++;
    if(now-t0>seg*1000){ if(state.playing)pause(); const ord=f0.slice(2).sort((a,b)=>a-b);
      res({ fotogramas:n, fpsMedio:+(1000/(ord.reduce((a,b)=>a+b,0)/Math.max(1,ord.length))).toFixed(1),
        msMediana:+ord[Math.floor(ord.length/2)].toFixed(1), msPeor:+ord[ord.length-1].toFixed(1),
        tironesMayores33ms: ord.filter(x=>x>33).length });
      return; } raf=requestAnimationFrame(tick); };
    play(); raf=requestAnimationFrame(tick); }); };
window.__vram=function(){ /* estimación: composite + caché RA + texturas de vídeo por clip */
  const comp=compW*compH*4; const ra=(typeof _raW!=='undefined')?(_ra.size*_raW*_raH*4):0;
  let vid=0; try{ for(const [,vi] of _vinst){ if(vi&&vi.vtex&&vi.w)vid+=vi.w*vi.h*4; } }catch(e){}
  return { compositeMB:+(comp/1048576).toFixed(1), cacheRAMB:+(ra/1048576).toFixed(1), texturasVideoMB:+(vid/1048576).toFixed(1),
    heapMB:performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):null }; };1`);

/* ---------- FASE A · su proyecto tal cual ---------------------------------------------------- */
const ISP=String.raw`C:\Users\beltr\Desktop\Rito Movie\360\Rito360.isp`;
const json=fs.readFileSync(ISP,'utf8');
await ev(`window.__isp=${JSON.stringify(json)};1`);
out.A_abrirProyecto=await ev(`(async function(){ const t0=performance.now();
  let err=null; try{ loadProject(JSON.parse(window.__isp)); }catch(e){ err=String(e.message||e); }
  await new Promise(r=>setTimeout(r,3000));   // que los medios se enganchen
  const as=activeSeq();
  return { msAbrir:Math.round(performance.now()-t0), err,
    lienzo:[state.seqW,state.seqH], modo:state.seqMode, fps:state.fps,
    clips:state.clips.length, pistas:state.lanes.length,
    medios:state.media.filter(m=>!isSeqMedia(m)).map(m=>({n:m.name,k:m.kind,px:(m.w||'')+'x'+(m.h||''),falta:!!m.missing,proxy:!!m.proxyReady})),
    composite:[compW,compH], calidad:state.previewQuality||1 }; })()`);
await wait(500);
out.A_render=await ev(`__mide(40)`);
out.A_vram=await ev(`__vram()`);

out.errs=await ev(`window.__errs.slice(0,25)`);
console.log(JSON.stringify(out,null,1));
ws.close();
