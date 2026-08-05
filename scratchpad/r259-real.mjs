/* [R259] El arreglo de R256 sobre el PROYECTO REAL de Beltran (copia de trabajo): 44 clips, 32 en bucle, nidos.
   Se exporta DOS veces el mismo tramo, uno que CRUZA la vuelta de un bucle, y se comparan por PIXELES.

   Este probe ABORTA en cuanto algo no cuadra, en vez de seguir y dar un "OK" que no significa nada. Ya paso:
   una version anterior exporto 48 fotogramas IDENTICOS ENTRE SI de una secuencia vacia (el proyecto no habia
   cargado) y el resultado parecia un aprobado perfecto. Comprobaciones obligatorias, en este orden:
     1. el proyecto carga y trae sus medios;
     2. la secuencia elegida tiene clips y bucles;
     3. el tramo elegido CRUZA una vuelta de verdad (se comprueba con srcT, no de cabeza);
     4. la primera pasada produce fotogramas DISTINTOS entre si (si no, no dibujo nada);
   y solo entonces se compara la segunda contra la primera.
   Todas las rutas se inyectan con JSON.stringify: nada de barras invertidas a mano. */
import http from 'http'; import fs from 'fs'; import path from 'path'; import cp from 'child_process'; import crypto from 'crypto';

const ISP='C:/Users/beltr/Desktop/Alma Digital Studio/Projects/Immersive Studio Pro/scratchpad/aud8b-rito-copia.isp';
const FPS=30, N=+(process.argv[2]||6);                // lo MINIMO que cruza la vuelta: no hace falta mas para probar
const RES=+(process.argv[3]||512);
const CAPAS=+(process.argv[4]||0);                    // >0 = dejar solo esas capas (para acotar la perdida de contexto)
const morir=(m)=>{ console.log('\n*** ABORTADO: '+m); process.exit(1); };

const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
if(!pg) morir('no hay ventana con index.html en el puerto 9222');
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:1800000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const sha=f=>crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');
function lst(d){ const o=[]; if(!fs.existsSync(d))return o;
  for(const e of fs.readdirSync(d,{withFileTypes:true})){ const q=d+'/'+e.name;
    if(e.isDirectory())o.push(...lst(q)); else if(/\.png$/i.test(e.name))o.push(q); } return o.sort(); }
function psnr(a,b){ const r=cp.spawnSync('ffmpeg',['-hide_banner','-i',a,'-i',b,'-lavfi','psnr','-f','null','-'],{encoding:'utf8'});
  const m=/average:([0-9.]+|inf)/.exec(String(r.stderr||'')); if(!m)throw new Error('ffmpeg no dio PSNR'); return m[1]==='inf'?Infinity:+m[1]; }

console.log('GPU: '+await ev(`(function(){const d=gl.getExtension('WEBGL_debug_renderer_info'); return d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):'?';})()`));

/* ---- 1. cargar el proyecto ------------------------------------------------------------------ */
await ev(`(async function(){ state.dirty=false; await openProjectPath(${JSON.stringify(ISP)},true); return 1; })()`);
await wait(8000);
const proy=await ev(`(function(){ return { medios:state.media.length, fps:state.fps,
  faltan:state.media.filter(m=>m.missing).map(m=>m.name),
  nidos:state.media.filter(m=>m.kind==='nest').map(m=>({id:m.id,n:m.name,b:(m.nestClips||[]).filter(c=>c.loop).length})) }; })()`);
console.log('proyecto: '+proy.medios+' medios · '+proy.fps+' fps · faltan: '+(proy.faltan.length?proy.faltan.join(', '):'ninguno'));
if(proy.medios<5) morir('el proyecto no cargo (solo '+proy.medios+' medios)');
console.log('nidos: '+proy.nidos.map(x=>x.n+'('+x.b+' bucles)').join(' · '));

/* ---- 2. entrar al nido con mas bucles ------------------------------------------------------- */
const obj=proy.nidos.filter(x=>x.b>0).sort((a,b)=>b.b-a.b)[0];
if(!obj) morir('ningun nido tiene clips en bucle');
const seq=await ev(`(async function(){ openSeq(${JSON.stringify(obj.id)}); await new Promise(r=>setTimeout(r,1500));
  const L=state.clips.filter(c=>c.loop&&c.loopLen>0);
  const v=L.map(c=>({n:(mediaById(c.mediaId)||{}).name, vuelta:+(c.start+c.loopLen/(c.speed||1)).toFixed(3)})).sort((a,b)=>a.vuelta-b.vuelta);
  return { n:(activeSeq()||{}).name, clips:state.clips.length, bucles:L.length, vueltas:v.slice(0,4) }; })()`);
console.log('secuencia activa: "'+seq.n+'" · '+seq.clips+' clips · '+seq.bucles+' en bucle');
if(seq.clips===0) morir('la secuencia activa esta VACIA');
if(seq.bucles===0) morir('la secuencia activa no tiene bucles: no probaria nada');
const T0=Math.max(0, seq.vueltas[0].vuelta-(N/FPS)/2), T1=T0+N/FPS;
console.log('primera vuelta en '+seq.vueltas[0].vuelta+'s ('+seq.vueltas[0].n+') · tramo '+T0.toFixed(3)+'-'+T1.toFixed(3)+'s');

/* ---- 3. comprobar que el tramo CRUZA la vuelta, segun srcT --------------------------------- */
const cruce=await ev(`(function(){ const c=state.clips.filter(x=>x.loop&&x.loopLen>0)
    .sort((a,b)=>(a.start+a.loopLen/(a.speed||1))-(b.start+b.loopLen/(b.speed||1)))[0];
  const s=[]; for(let k=0;k<${N};k++) s.push(+srcT(c,${T0}+k/${FPS}).toFixed(4));
  let saltos=0; for(let k=1;k<s.length;k++) if(s[k]<s[k-1]-0.001) saltos++;
  return { saltosAtras:saltos, primero:s[0], ultimo:s[s.length-1] }; })()`);
console.log('srcT en el tramo: '+cruce.primero+' -> '+cruce.ultimo+'   saltos hacia atras (vueltas): '+cruce.saltosAtras);
if(cruce.saltosAtras===0) morir('el tramo NO cruza ninguna vuelta: no probaria el arreglo');

/* ---- 3b. testigo de perdida de contexto + recorte opcional de capas ------------------------- */
await ev(`(function(){ try{ localStorage.removeItem('__ctx'); }catch(e){}
  glc.addEventListener('webglcontextlost',()=>{ try{ localStorage.setItem('__ctx','perdido'); }catch(e){} });
  return 1; })()`);
if(CAPAS>0){
  const rec=await ev(`(function(){ const c=state.clips.slice().sort((a,b)=>a.lane-b.lane).slice(0,${CAPAS});
    state.clips=c; renderTimeline(); render(); return state.clips.length; })()`);
  console.log('recortado a '+rec+' capas para acotar');
}

/* ---- 4. exportar ---------------------------------------------------------------------------- */
async function pasada(i){
  const DIR=path.join(process.cwd(),'scratchpad','r259r-p'+i);
  fs.rmSync(DIR,{recursive:true,force:true}); fs.mkdirSync(DIR,{recursive:true});
  const t0=Date.now();
  const r=await ev(`(async function(){ const ui=ripProgress('R259','pasada ${i}',1);
    try{ await runExport({codec:'png',res:${RES},fps:${FPS},range:'clips',rangeT:[${T0},${T1}],
          outW:${RES},outH:${RES},outDir:${JSON.stringify(DIR)},silent:true,noAudio:true,job:ui.job
          ${process.argv[5]==='novideo'?', wcDecode:false':''}}); }
    finally{ ui.close(); }
    return { rendidos:state.media.filter(m=>m._cdFail).map(m=>m.name) }; })()`);
  const f=lst(DIR), ms=Date.now()-t0;
  try{ const ctx=await ev(`localStorage.getItem('__ctx')||'no'`); if(ctx!=='no') console.log('   *** SE PERDIO EL CONTEXTO GRAFICO durante la pasada '+i); }catch(e){ console.log('   *** la pagina se recargo durante la pasada '+i+' (contexto perdido)'); }
  const distintos=new Set(f.map(sha)).size;
  console.log('  pasada '+i+': '+f.length+' PNG · '+distintos+' distintos entre si · '
    +(ms/1000).toFixed(1)+' s ('+Math.round(ms/Math.max(1,f.length))+' ms/f) · se rindieron: '
    +(r.rendidos.length?r.rendidos.join(', '):'ninguno'));
  return { f, distintos };
}
console.log('');
const A=await pasada(1);
if(A.f.length<N) morir('la pasada 1 escribio '+A.f.length+' de '+N+' fotogramas');
if(A.distintos<2) morir('los '+A.f.length+' fotogramas de la pasada 1 son IDENTICOS entre si: no se dibujo nada');
const B=await pasada(2);
if(B.f.length!==A.f.length) morir('las dos pasadas no escribieron el mismo numero de fotogramas');

/* ---- 5. comparar por pixeles ---------------------------------------------------------------- */
let ident=0, malos=0, peor=Infinity, peorN='';
for(let i=0;i<A.f.length;i++){ const v=psnr(A.f[i],B.f[i]);
  if(v===Infinity){ ident++; continue; }
  if(v<peor){ peor=v; peorN=path.basename(A.f[i]); }
  if(v<90){ malos++; if(malos<=6) console.log('   *** '+path.basename(A.f[i])+'  '+v.toFixed(2)+' dB'); } }
console.log('\npasada 1 vs 2: '+A.f.length+' fotogramas · '+ident+' identicos bit a bit · '
  +(malos?malos+' POR DEBAJO DE 90 dB  *** MAL ***':'ninguno por debajo de 90 dB  → OK')
  +(peor===Infinity?'':'  · el peor: '+peorN+' '+peor.toFixed(2)+' dB'));
ws.close();
