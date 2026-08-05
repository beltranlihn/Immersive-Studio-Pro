/* [R254b] A/B en serio sobre lo unico que sobrevivio a dos pasadas: un clip en BUCLE CORTO exporta mucho mas
   lento que el mismo clip sin bucle.
   El perfil anterior (r254-perfil-export.mjs) no vale para atribuir costes: sus numeros variaban 5-10x entre
   pasadas y su propio control demostro que el ORDEN sesga 2x. Asi que aqui:
     - se ALTERNAN A y B en vez de correr una lista,
     - se repite N veces y se toma la MEDIANA (no la media: una pasada mala la arrastra),
     - se descarta una pasada de calentamiento,
     - y se declara la diferencia solo si el peor caso de uno sigue por debajo del mejor del otro. */
import http from 'http'; import fs from 'fs'; import path from 'path';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:900000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const VID='C:/Users/beltr/Desktop/Alma Digital Studio/Code/Alma Digital Portfolio/Asset/Reel Portfolio/Reel Portfolio.mp4';
const mediana=a=>{ const s=a.slice().sort((x,y)=>x-y); const n=s.length; return n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2; };

await cmd('Page.enable'); await cmd('Page.reload',{ignoreCache:true}); await wait(3800);
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e))); return 1; })()`);
console.log('GPU:', await ev(`(function(){const d=gl.getExtension('WEBGL_debug_renderer_info'); return d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):'?';})()`));
await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`); await wait(1200);
await ev(`window.__vid=function(ruta,nombre){ return new Promise(res=>{ const url=DSP.toFileURL(ruta); const v=document.createElement("video"); v.preload="metadata"; v.src=url;
  v.addEventListener("loadedmetadata",()=>{ const m={id:uid(),name:nombre,kind:"video",el:v,originalEl:v,srcUrl:url,tex:newTex(),w:v.videoWidth,h:v.videoHeight,dur:v.duration,fps:30,color:clipColorFor("video"),proxyReady:false,proxyPct:0,path:ruta,fsize:0,folder:null,missing:false,_loading:false};
    state.media.push(m); renderMedia(); res(+m.dur.toFixed(2)); }); v.addEventListener("error",()=>res(null)); }); };1`);
console.log('video real: '+await ev(`__vid(${JSON.stringify(VID)},"reel.mp4")`)+' s');

const N=60, FPS=30, SEGS=N/FPS;
async function corre(nombre, loopLen){
  const OUT=path.join(process.cwd(),'scratchpad','r254b-'+nombre+'.mp4');
  try{ fs.rmSync(OUT); }catch(e){}
  await ev(`(function(){ state.clips=[]; state.media=state.media.filter(m=>m.kind!=='nest');
    const V=state.media.find(m=>m.kind==='video');
    const vl=state.lanes.findIndex(l=>l.kind==='video');
    const c=makeClip(V,vl,0); c.dur=${SEGS}; c.inP=4; state.clips.push(c);
    ${loopLen? `state.selId=c.id; state.selIds=[c.id]; toggleLoop(c); setLoopRange(c,${loopLen}); c.dur=${SEGS};` : ''}
    renderTimeline(); render(); return 1; })()`);
  const t0=Date.now();
  await ev(`(async()=>{ const ui=ripProgress('A/B','${nombre}',1); try{
      await runExport({codec:'h264', res:512, fps:${FPS}, bitrate:8, range:'clips', rangeT:[0,${SEGS}],
                       outW:512, outH:512, outPath:${JSON.stringify(OUT)}, silent:true, noAudio:true, job:ui.job});
      ui.close(); return 1; }catch(e){ try{ui.close();}catch(_){} return 0; } })()`);
  return (Date.now()-t0)/N;
}

console.log('\ncalentando...');
await corre('warm', 0);

const A=[], B=[], REP=4;
console.log('alternando '+REP+' veces (A = sin bucle · B = bucle de 0,4 s), '+N+' fotogramas cada una:\n');
for(let i=0;i<REP;i++){
  const a=await corre('A'+i, 0);      A.push(a);
  const b=await corre('B'+i, 0.4);    B.push(b);
  console.log('   vuelta '+(i+1)+':   sin bucle '+String(Math.round(a)).padStart(5)+' ms/f      con bucle '+String(Math.round(b)).padStart(5)+' ms/f');
}
const mA=mediana(A), mB=mediana(B), pA=Math.max(...A), pB=Math.min(...B);
console.log('\n   mediana sin bucle: '+Math.round(mA)+' ms/fotograma   (rango '+Math.round(Math.min(...A))+'-'+Math.round(pA)+')');
console.log('   mediana con bucle: '+Math.round(mB)+' ms/fotograma   (rango '+Math.round(pB)+'-'+Math.round(Math.max(...B))+')');
console.log('   factor: x'+(mB/mA).toFixed(1));
console.log('\n   ' + (pA < pB
  ? 'SEPARACION LIMPIA: la peor pasada sin bucle sigue por debajo de la mejor con bucle. El bucle CUESTA.'
  : 'SE SOLAPAN: los rangos se pisan, no se puede afirmar la diferencia con este numero de repeticiones.'));
console.log('\nerrs JS: '+JSON.stringify(await ev(`window.__errs.slice(0,5)`)));
ws.close();
