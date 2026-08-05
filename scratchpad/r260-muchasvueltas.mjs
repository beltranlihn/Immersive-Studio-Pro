/* [R260] Un export con MUCHAS vueltas de bucle: lo que el tope de 12 reinicios habria estropeado a mitad.
   180 fotogramas con un bucle de 0,4 s = 15 vueltas. Corto a proposito (256 px). Se comprueba que no se rinde
   nadie, que el ritmo NO se degrada en la segunda mitad, y que las parejas k/k+12 siguen coincidiendo. */
import http from 'http'; import fs from 'fs'; import path from 'path'; import crypto from 'crypto';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:900000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const VID='C:/Users/beltr/Desktop/Alma Digital Studio/Code/Alma Digital Portfolio/Asset/Reel Portfolio/Reel Portfolio.mp4';
const N=180, FPS=30, LOOP=0.4, RES=256;
await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`); await wait(1400);
await ev(`window.__vid=function(ruta,nombre){ return new Promise(res=>{ const url=DSP.toFileURL(ruta); const v=document.createElement("video"); v.preload="metadata"; v.src=url;
  v.addEventListener("loadedmetadata",()=>{ const m={id:uid(),name:nombre,kind:"video",el:v,originalEl:v,srcUrl:url,tex:newTex(),w:v.videoWidth,h:v.videoHeight,dur:v.duration,fps:30,color:clipColorFor("video"),proxyReady:false,proxyPct:0,path:ruta,fsize:0,folder:null,missing:false,_loading:false};
    state.media.push(m); renderMedia(); res(1); }); v.addEventListener("error",()=>res(0)); }); };1`);
await ev(`__vid(${JSON.stringify(VID)},"reel.mp4")`);
const DIR=path.join(process.cwd(),'scratchpad','r260-vueltas');
fs.rmSync(DIR,{recursive:true,force:true}); fs.mkdirSync(DIR,{recursive:true});
/* el job informa de cada fotograma: asi se ve si el ritmo se degrada pasada la vuelta 12 */
const t0=Date.now();
const r=await ev(`(async function(){ window.__t=[]; let prev=performance.now();
  state.clips=[]; const V=state.media.find(m=>m.kind==='video'); const vl=state.lanes.findIndex(l=>l.kind==='video');
  const c=makeClip(V,vl,0); c.dur=${N/FPS}; c.inP=4; c.props.el=90; c.props.size=90; state.clips.push(c);
  state.selId=c.id; state.selIds=[c.id]; toggleLoop(c); setLoopRange(c,${LOOP}); c.dur=${N/FPS};
  renderTimeline(); render();
  const ui=ripProgress('R260','muchas vueltas',1);
  const job=ui.job, fOrig=job.frame; job.frame=(i,tot)=>{ const n=performance.now(); __t.push(n-prev); prev=n; if(fOrig)fOrig(i,tot); };
  try{ await runExport({codec:'png',res:${RES},fps:${FPS},range:'clips',rangeT:[0,${N/FPS}],outW:${RES},outH:${RES},
        outDir:${JSON.stringify(DIR)},silent:true,noAudio:true,job}); }finally{ ui.close(); }
  const T=__t.slice(1), mit=Math.floor(T.length/2);
  const med=(a)=>{const s=a.slice().sort((x,y)=>x-y); return Math.round(s[Math.floor(s.length/2)]);};
  return { rendido:!!V._cdFail, n:T.length, primeraMitad:med(T.slice(0,mit)), segundaMitad:med(T.slice(mit)) }; })()`);
const ms=Date.now()-t0;
function lst(d){ const o=[]; for(const e of fs.readdirSync(d,{withFileTypes:true})){ const q=d+'/'+e.name;
  if(e.isDirectory())o.push(...lst(q)); else if(/\.png$/i.test(e.name))o.push(q); } return o.sort(); }
const f=lst(DIR), sha=x=>crypto.createHash('sha1').update(fs.readFileSync(x)).digest('hex');
console.log(f.length+' PNG en '+(ms/1000).toFixed(1)+' s · '+Math.round(ms/Math.max(1,f.length))+' ms/f de media · se rindio: '+(r.rendido?'SI ***':'no'));
console.log('ritmo por fotograma — primera mitad '+r.primeraMitad+' ms · segunda mitad '+r.segundaMitad+' ms'
  + (r.segundaMitad > r.primeraMitad*2.5 ? '   *** SE DEGRADA ***' : '   (sin degradacion)'));
const h=f.map(sha); let mal=0; for(let i=0;i+12<h.length;i++) if(h[i]!==h[i+12])mal++;
console.log('parejas k/k+12 que NO coinciden: '+mal+' de '+(h.length-12)+(mal?'  (mirar por PSNR: 1 pixel de redondeo tambien cuenta aqui)':''));
if(r.rendido) console.log('\n*** el decodificador se rindio: MAL');
ws.close();
