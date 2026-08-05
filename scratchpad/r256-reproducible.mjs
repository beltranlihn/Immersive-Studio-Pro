/* [R256] ¿Es REPRODUCIBLE una exportacion? El mismo codigo (mismo sha1 de asar) dio 24 de 90 fotogramas distintos
   entre dos pasadas del mismo export. Si eso se confirma, el master de la pelicula depende de la carga de la
   maquina, que es infinitamente mas grave que cualquier cuestion de velocidad.
   Metodo: LA MISMA exportacion N veces, comparando los PNG uno a uno y anotando si el decodificador por clip se
   rindio (_cdFail) en cada pasada. */
import http from 'http'; import fs from 'fs'; import path from 'path'; import crypto from 'crypto';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:900000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const VID='C:/Users/beltr/Desktop/Alma Digital Studio/Code/Alma Digital Portfolio/Asset/Reel Portfolio/Reel Portfolio.mp4';
const REP=3, N=60, FPS=30, SEGS=N/FPS, LOOP=0.4;

function lista(d){ if(!fs.existsSync(d))return []; const o=[];
  for(const e of fs.readdirSync(d,{withFileTypes:true})){ const q=d+'/'+e.name;
    if(e.isDirectory())o.push(...lista(q)); else if(/\.png$/i.test(e.name))o.push(q); } return o.sort(); }
const sha=f=>crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0,10);

async function pasada(i,conBucle){
  await cmd('Page.reload',{ignoreCache:true}); await wait(3800);   // sesion limpia en cada pasada
  await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`); await wait(1200);
  await ev(`window.__vid=function(ruta,nombre){ return new Promise(res=>{ const url=DSP.toFileURL(ruta); const v=document.createElement("video"); v.preload="metadata"; v.src=url;
    v.addEventListener("loadedmetadata",()=>{ const m={id:uid(),name:nombre,kind:"video",el:v,originalEl:v,srcUrl:url,tex:newTex(),w:v.videoWidth,h:v.videoHeight,dur:v.duration,fps:30,color:clipColorFor("video"),proxyReady:false,proxyPct:0,path:ruta,fsize:0,folder:null,missing:false,_loading:false};
      state.media.push(m); renderMedia(); res(1); }); v.addEventListener("error",()=>res(0)); }); };1`);
  await ev(`__vid(${JSON.stringify(VID)},"reel.mp4")`);
  const DIR=path.join(process.cwd(),'scratchpad','r256-'+(conBucle?'bucle':'liso')+'-'+i);
  fs.rmSync(DIR,{recursive:true,force:true}); fs.mkdirSync(DIR,{recursive:true});
  const t0=Date.now();
  const r=await ev(`(async()=>{ state.clips=[];
    const V=state.media.find(m=>m.kind==='video'); const vl=state.lanes.findIndex(l=>l.kind==='video');
    const c=makeClip(V,vl,0); c.dur=${SEGS}; c.inP=4; c.props.el=90; c.props.size=90; state.clips.push(c);
    ${conBucle?`state.selId=c.id; state.selIds=[c.id]; toggleLoop(c); setLoopRange(c,${LOOP}); c.dur=${SEGS};`:''}
    renderTimeline(); render();
    const ui=ripProgress('R256','pasada ${i}',1);
    try{ await runExport({codec:'png', res:512, fps:${FPS}, range:'clips', rangeT:[0,${SEGS}], outW:512, outH:512,
                          outDir:${JSON.stringify(DIR)}, silent:true, noAudio:true, job:ui.job}); }
    finally{ ui.close(); }
    return { cdFail:!!V._cdFail }; })()`);
  const ms=Date.now()-t0;
  const sellos=lista(DIR).map(sha);
  return { sellos, ms:Math.round(ms/N), cdFail:r.cdFail };
}

for(const conBucle of [true,false]){
  console.log('\n===== '+(conBucle?'CLIP EN BUCLE (0,4 s)':'EL MISMO CLIP SIN BUCLE')+' — '+REP+' pasadas identicas =====');
  const res=[];
  for(let i=1;i<=REP;i++){ const r=await pasada(i,conBucle); res.push(r);
    console.log('   pasada '+i+':  '+String(r.ms).padStart(4)+' ms/f   '+r.sellos.length+' PNG   se rindio el decodificador: '+(r.cdFail?'SI':'no')); }
  for(let i=1;i<res.length;i++){
    let dif=0; for(let k=0;k<Math.max(res[0].sellos.length,res[i].sellos.length);k++) if(res[0].sellos[k]!==res[i].sellos[k])dif++;
    console.log('   pasada 1 vs '+(i+1)+':  '+dif+' fotogramas distintos de '+res[0].sellos.length
      +(dif===0?'   IDENTICAS':'   *** NO REPRODUCIBLE ***'));
  }
}
console.log('\nerrs JS: '+JSON.stringify(await ev(`window.__errs?window.__errs.slice(0,4):[]`)));
ws.close();
