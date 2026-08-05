/* [R261] El caso del hallazgo: un bucle cuyo tramo cae al FINAL del archivo. Ahi `feed>=N` pide el vaciado, la
   vuelta reinicia el decodificador, y el rechazo del `flush()` viejo marcaba `vaciado` sobre el nuevo -> `passed()`
   daba por bueno cualquier fotograma. Sintoma: fotogramas equivocados en el master, en silencio.
   Prueba corta: 7 vueltas, 256 px. El criterio es INTRINSECO: k y k+12 son el mismo instante de fuente.
   Se corre igual contra el .exe (sin el arreglo) y contra dev (con el arreglo). */
import http from 'http'; import fs from 'fs'; import path from 'path'; import crypto from 'crypto'; import cp from 'child_process';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:900000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const FASE=process.argv[2]||'x';
const VID='C:/Users/beltr/Desktop/Alma Digital Studio/Code/Alma Digital Portfolio/Asset/Reel Portfolio/Reel Portfolio.mp4';
const N=84, FPS=30, LOOP=0.4, RES=256;
await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`); await wait(1400);
await ev(`window.__vid=function(ruta,nombre){ return new Promise(res=>{ const url=DSP.toFileURL(ruta); const v=document.createElement("video"); v.preload="metadata"; v.src=url;
  v.addEventListener("loadedmetadata",()=>{ const m={id:uid(),name:nombre,kind:"video",el:v,originalEl:v,srcUrl:url,tex:newTex(),w:v.videoWidth,h:v.videoHeight,dur:v.duration,fps:30,color:clipColorFor("video"),proxyReady:false,proxyPct:0,path:ruta,fsize:0,folder:null,missing:false,_loading:false};
    state.media.push(m); renderMedia(); res(+m.dur.toFixed(3)); }); v.addEventListener("error",()=>res(null)); }); };1`);
const dur=await ev(`__vid(${JSON.stringify(VID)},"reel.mp4")`);
const DIR=path.join(process.cwd(),'scratchpad','r261-'+FASE);
fs.rmSync(DIR,{recursive:true,force:true}); fs.mkdirSync(DIR,{recursive:true});
/* el tramo del bucle, PEGADO al final del archivo: es lo que fuerza `feed>=N` y el vaciado */
const inP=Math.max(0, dur-LOOP-0.02);
const t0=Date.now();
const r=await ev(`(async function(){ state.clips=[];
  const V=state.media.find(m=>m.kind==='video'); const vl=state.lanes.findIndex(l=>l.kind==='video');
  const c=makeClip(V,vl,0); c.dur=${N/FPS}; c.inP=${inP}; c.props.el=90; c.props.size=90; state.clips.push(c);
  state.selId=c.id; state.selIds=[c.id]; toggleLoop(c); setLoopRange(c,${LOOP}); c.dur=${N/FPS};
  renderTimeline(); render();
  const ui=ripProgress('R261','${FASE}',1);
  try{ await runExport({codec:'png',res:${RES},fps:${FPS},range:'clips',rangeT:[0,${N/FPS}],outW:${RES},outH:${RES},
        outDir:${JSON.stringify(DIR)},silent:true,noAudio:true,job:ui.job}); }finally{ ui.close(); }
  return { rendido:!!V._cdFail, inP:+c.inP.toFixed(3), loopLen:c.loopLen }; })()`);
const ms=Date.now()-t0;
function lst(d){ const o=[]; for(const e of fs.readdirSync(d,{withFileTypes:true})){ const q=d+'/'+e.name;
  if(e.isDirectory())o.push(...lst(q)); else if(/\.png$/i.test(e.name))o.push(q); } return o.sort(); }
function psnr(a,b){ const q=cp.spawnSync('ffmpeg',['-hide_banner','-i',a,'-i',b,'-lavfi','psnr','-f','null','-'],{encoding:'utf8'});
  const m=/average:([0-9.]+|inf)/.exec(String(q.stderr||'')); return m? (m[1]==='inf'?Infinity:+m[1]) : NaN; }
const f=lst(DIR), sha=x=>crypto.createHash('sha1').update(fs.readFileSync(x)).digest('hex');
console.log('['+FASE+'] archivo de '+dur+'s · bucle en '+r.inP+' + '+r.loopLen+'s (pegado al final) · '
  +f.length+' PNG en '+(ms/1000).toFixed(1)+'s · se rindio: '+(r.rendido?'SI':'no'));
const h=f.map(sha); const dif=[];
for(let i=0;i+12<h.length;i++) if(h[i]!==h[i+12]) dif.push(i);
let malos=0, peor=Infinity;
for(const i of dif.slice(0,40)){ const v=psnr(f[i],f[i+12]); if(v<peor)peor=v; if(v<90)malos++; }
console.log('   parejas k/k+12 distintas: '+dif.length+' de '+(h.length-12)
  +'  ·  de ellas, FOTOGRAMA EQUIVOCADO (<90 dB): '+malos
  +(dif.length?('  · el peor: '+(peor===Infinity?'identicas':peor.toFixed(2)+' dB')):''));
console.log('   veredicto: '+(malos? '*** MAL: '+malos+' fotogramas equivocados en el master' : 'OK, ninguno equivocado'));
ws.close();
