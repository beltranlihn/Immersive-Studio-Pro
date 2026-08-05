/* [R255] Caché del tramo del bucle en el export. Exporta a PNG-seq (fotogramas exactos, sin ruido de encoder) un
   clip en bucle corto. Se corre ANTES y DESPUES del cambio, con la MISMA semilla, y se comparan los PNG uno a uno.
   Condicion de aceptacion: identicos BIT A BIT. Solo entonces se mira el cronometro.
   Uso:  node scratchpad/r255-loopcache.mjs antes|despues */
import http from 'http'; import fs from 'fs'; import path from 'path'; import crypto from 'crypto';
const FASE=(process.argv[2]||'antes');
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:900000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const VID='C:/Users/beltr/Desktop/Alma Digital Studio/Code/Alma Digital Portfolio/Asset/Reel Portfolio/Reel Portfolio.mp4';
const DIR=path.join(process.cwd(),'scratchpad','r255-'+FASE);

await cmd('Page.enable'); await cmd('Page.reload',{ignoreCache:true}); await wait(3800);
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e))); return 1; })()`);
console.log('fase: '+FASE+'   GPU: '+await ev(`(function(){const d=gl.getExtension('WEBGL_debug_renderer_info'); return d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):'?';})()`));
await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`); await wait(1200);
await ev(`window.__vid=function(ruta,nombre){ return new Promise(res=>{ const url=DSP.toFileURL(ruta); const v=document.createElement("video"); v.preload="metadata"; v.src=url;
  v.addEventListener("loadedmetadata",()=>{ const m={id:uid(),name:nombre,kind:"video",el:v,originalEl:v,srcUrl:url,tex:newTex(),w:v.videoWidth,h:v.videoHeight,dur:v.duration,fps:30,color:clipColorFor("video"),proxyReady:false,proxyPct:0,path:ruta,fsize:0,folder:null,missing:false,_loading:false};
    state.media.push(m); renderMedia(); res(+m.dur.toFixed(2)); }); v.addEventListener("error",()=>res(null)); }); };1`);
await ev(`__vid(${JSON.stringify(VID)},"reel.mp4")`);

/* 90 fotogramas a 30 fps = 3 s, con un bucle de 0,4 s -> 7 vueltas completas: se ve claro si algo se descoloca */
const N=90, FPS=30, SEGS=N/FPS, LOOP=0.4;
fs.rmSync(DIR,{recursive:true,force:true}); fs.mkdirSync(DIR,{recursive:true});
const esc=await ev(`(function(){ state.clips=[];
  const V=state.media.find(m=>m.kind==='video'); const vl=state.lanes.findIndex(l=>l.kind==='video');
  const c=makeClip(V,vl,0); c.dur=${SEGS}; c.inP=4; c.props.el=90; c.props.size=90; state.clips.push(c);
  state.selId=c.id; state.selIds=[c.id]; toggleLoop(c); setLoopRange(c,${LOOP}); c.dur=${SEGS};
  renderTimeline(); render();
  return { inP:c.inP, loopLen:+c.loopLen.toFixed(3), dur:c.dur,
           muestras:[0,0.2,0.39,0.41,0.6,1.21].map(t=>+srcT(c,t).toFixed(4)) }; })()`);
console.log('clip: entrada '+esc.inP+'s · bucle '+esc.loopLen+'s · dura '+esc.dur+'s');
console.log('   srcT en 0/0,2/0,39/0,41/0,6/1,21 → '+JSON.stringify(esc.muestras)+'  (se ve la vuelta)');

const t0=Date.now();
const r=await ev(`(async()=>{ const ui=ripProgress('R255','${FASE}',1); try{
    await runExport({codec:'png', res:512, fps:${FPS}, range:'clips', rangeT:[0,${SEGS}],
                     outW:512, outH:512, outDir:${JSON.stringify(DIR)}, outPath:${JSON.stringify(DIR)},
                     silent:true, noAudio:true, job:ui.job});
    ui.close(); return {ok:1, resets:(function(){ let s=[]; for(const [,vi] of _vinst) if(vi.cd&&vi.cd.stats) s.push(vi.cd.stats()); return s; })()};
  }catch(e){ try{ui.close();}catch(_){} return {ok:0,err:String(e&&e.message||e)}; } })()`);
const ms=Date.now()-t0;
/* el export PNG-seq crea una SUBCARPETA <pre>_<dims>_<fps>: hay que bajar a ella */
function listaPngs(dir){ if(!fs.existsSync(dir))return []; const out=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){ const p=dir+'/'+e.name;
    if(e.isDirectory())out.push(...listaPngs(p)); else if(/\.png$/i.test(e.name))out.push(p); }
  return out.sort(); }
const pngs=listaPngs(DIR);
console.log('\nexport: '+(r.ok?'OK':'*** '+r.err+' ***')+'   '+(ms/1000).toFixed(1)+' s   '+Math.round(ms/N)+' ms/fotograma   '+pngs.length+' PNG');
const sellos=pngs.map(f=>crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0,12));
fs.writeFileSync(path.join(process.cwd(),'scratchpad','r255-'+FASE+'.json'),
  JSON.stringify({fase:FASE, ms, msPorFotograma:Math.round(ms/N), n:pngs.length, sellos},null,1));
/* los fotogramas del bucle DEBEN repetirse: el 0 y el 12 son el mismo instante de fuente */
const rep=(sellos[0]&&sellos[12]&&sellos[0]===sellos[12]);
console.log('   fotograma 0 vs 12 (una vuelta de bucle): '+(rep?'IGUALES, como debe ser':'distintos ('+sellos[0]+' vs '+sellos[12]+')'));
console.log('   distintos en total: '+new Set(sellos).size+' de '+sellos.length+'  (un bucle de 0,4 s a 30 fps = 12 fotogramas unicos)');
console.log('errs JS: '+JSON.stringify(await ev(`window.__errs.slice(0,4)`)));
ws.close();
