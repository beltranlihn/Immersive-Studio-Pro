/* [R261] El caso del hallazgo: un bucle cuyo tramo cae al FINAL del archivo. Ahi `feed>=N` pide el vaciado, la
   vuelta reinicia el decodificador, y el rechazo del `flush()` viejo marcaba `vaciado` sobre el nuevo -> `passed()`
   daba por bueno cualquier fotograma. Sintoma: fotogramas equivocados en el master, en silencio.
   Prueba corta: 7 vueltas, 256 px. El criterio es INTRINSECO: k y k+12 son el mismo instante de fuente.
   [R345b] El criterio es INTRINSECO a una sola corrida (k contra k+12), asi que ya no hace falta compararla
   con otra: el argumento `FASE` sobrevive solo para nombrar la carpeta de volcado al correrla a mano. */
/* [R344c] ESTA SONDA YA DISCRIMINA, y por eso pasa a ser una RED.
   La nota de `docs/NEXT.md` decia que no servia para distinguir el arreglo de R261 «precisamente porque la
   rendicion tapa el sintoma»: el decodificador se rendia a los 10 s, el export caia al repliegue `<video>` —
   lento pero correcto— y los fotogramas salian bien por el camino equivocado. R344b quito esa rendicion, y en
   la primera corrida esta sonda canto **10 fotogramas equivocados de 72 parejas, el peor a 28,27 dB**: el
   peligro latente que la misma nota anunciaba («lo que nos protege es una averia»). R344c lo cerro haciendo
   honesto el atajo de fin de archivo de `passed()`.
   Como ahora SI se pone roja cuando toca, entra en `npm run redes`. Codigo 3 si falta el material. */
import http from 'http'; import fs from 'fs'; import path from 'path'; import crypto from 'crypto'; import cp from 'child_process';
const VID='C:/Users/beltr/Desktop/Alma Digital Studio/Code/Alma Digital Portfolio/Asset/Reel Portfolio/Reel Portfolio.mp4';
if(!fs.existsSync(VID)){ console.log('   NO MEDIDA: falta el material -> '+VID); process.exit(3); }
/* [R345b] Y el JUEZ, no solo el material. El veredicto lo da `ffmpeg` via PSNR; si falta, `psnr()` devolvia
   `NaN`, `NaN<90` es falso, `malos` se quedaba en 0 y la red aprobaba habiendo medido cero — imprimiendo ademas
   "el peor: identicas" sobre unos ficheros cuyos sha1 acababa de ver que difieren. En un clon limpio o en el
   Mac eso es exactamente el "verde sin medir" que el codigo 3 existe para matar. */
{ const q=cp.spawnSync('ffmpeg',['-hide_banner','-version'],{encoding:'utf8'});
  if(q.error||q.status!==0){ console.log('   NO MEDIDA: falta ffmpeg en el PATH, y es quien da el veredicto (PSNR)'); process.exit(3); } }
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:150000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const FASE=process.argv[2]||'x';

const N=84, FPS=30, LOOP=0.4, RES=256;
await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`); await wait(1400);
/* [R345b] Envuelto en un IIFE para que cierre con el patron canonico `})()`);`: el cierre viejo (`};1`);`)
   dejaba al guardian de acentos graves de `correr-redes.mjs` creyendose dentro de la plantilla, y soltaba TRES
   avisos falsos en cada corrida al lado de la red mas propensa a ponerse roja de verdad. */
await ev(`(function(){ window.__vid=function(ruta,nombre){ return new Promise(res=>{ const url=DSP.toFileURL(ruta); const v=document.createElement("video"); v.preload="metadata"; v.src=url;
  v.addEventListener("loadedmetadata",()=>{ const m={id:uid(),name:nombre,kind:"video",el:v,originalEl:v,srcUrl:url,tex:newTex(),w:v.videoWidth,h:v.videoHeight,dur:v.duration,fps:30,color:clipColorFor("video"),proxyReady:false,proxyPct:0,path:ruta,fsize:0,folder:null,missing:false,_loading:false};
    state.media.push(m); renderMedia(); res(+m.dur.toFixed(3)); }); v.addEventListener("error",()=>res(null)); }); }; return 1; })()`);
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
/* [R345b] Se comprueba que el export produjo lo que se le pidio. Sin esto, un `runExport` que fallara en
   silencio, se cancelara o escribiera en otro sitio dejaba `dif` vacio -> `malos=0` -> "OK, ninguno equivocado"
   -> salida 0: una red verde afirmando haber verificado un master de 84 fotogramas que no existe. */
const faltanPng = (f.length!==N);
/* [R345b] Y se miran TODAS las parejas, no las 40 primeras. El tope silencioso contradecia el texto ("de ellas")
   y escondia una regresion cuyas primeras 40 diferencias fueran benignas. Medido: cada PSNR son ~37 ms, y en
   verde solo hay 1-2 parejas distintas, asi que el caso normal no cuesta nada; el peor caso son 72 x 37 ms. */
let malos=0, peor=Infinity, sinJuez=0;
for(const i of dif){ const v=psnr(f[i],f[i+12]);
  if(!Number.isFinite(v)&&v!==Infinity){ sinJuez++; continue; }   // ffmpeg no dio numero: NO cuenta como aprobado
  if(v<peor)peor=v; if(v<90)malos++; }
console.log('   parejas k/k+12 distintas: '+dif.length+' de '+(h.length-12)
  +'  ·  de ellas, FOTOGRAMA EQUIVOCADO (<90 dB): '+malos
  +(dif.length?('  · el peor: '+(peor===Infinity?'identicas':peor.toFixed(2)+' dB')):'')
  +(sinJuez?('  *** '+sinJuez+' sin medir (ffmpeg no devolvio PSNR)'):''));
if(faltanPng) console.log('   *** el export produjo '+f.length+' PNG y se esperaban '+N+': la medida NO vale');
console.log('   veredicto: '+(malos? '*** MAL: '+malos+' fotogramas equivocados en el master' : 'OK, ninguno equivocado'));
/* [R344c] Una red tiene que poder ponerse ROJA: sin codigo de salida, el lanzador la contaba como pasada
   aunque el veredicto dijera «MAL». Se anade tambien la rendicion, que ya no debe ocurrir en este caso. */
if(r.rendido) console.log('   *** el decodificador se RINDIO (_cdFail): el export cae al repliegue <video>');
ws.close(); process.exitCode = (malos || r.rendido || faltanPng || sinJuez) ? 1 : 0;
