/* [R346c] RED: el giro de un bucle en ping-pong no repite fotograma.

   Por que existe: R346b "cerro" la ventana `[inP, inP+loopLen)` del espejo del ping-pong con
   `ph=Math.min(L-ph, L-2*TOL_DECOD)` y eso fue una REGRESION. `Math.min` no corre la rampa: aplana el vertice
   sobre su vecino. El espejo ya hace que la muestra anterior al vertice y la posterior caigan en el mismo
   tiempo de origen, asi que lo unico que las separaba era que el vertice cayera en otro fotograma. Medido: el
   giro pasaba de `22,23,24,23,22` a `22,23,23,23,22` — una MESETA de tres fotogramas, 125 ms de tiron a 24 fps,
   horneada en el export. Se revirtio en R346c.

   Y por que NO la vio nadie: el cambio no tenia red. Una sonda que preguntara "?el instante cae dentro de la
   ventana?" habria APROBADO la regresion — mide la premisa. La que decide es esta: que fotograma se ENTREGA
   alrededor del giro, y que no se repita ninguno.

   Criterio, sin oraculo: en un tramo de instantes consecutivos que cruza el vertice del ping-pong, los
   fotogramas entregados no pueden repetirse. Da igual cual sea "el correcto"; una fuente que se mueve no puede
   entregar dos veces seguidas el mismo fotograma cuando el cabezal avanza.
   (El fotograma que el espejo deja UN paso fuera de la ventana no se vigila aqui a proposito: es el precio
   conocido y aceptado del espejo exacto, satura sin dano al final del medio, y cerrarlo exige restar un paso de
   fotograma con el fps de la FUENTE. Si algun dia se hace, esta red sigue valiendo tal cual.)

   SABE FALLAR, y se comprueba en cada corrida: se reconstruye el estado de R346b aplicando su propio
   `Math.min(ph, L-2*TOL_DECOD)` a la fase que devuelve el `srcT` de verdad, y se exige que esa pasada SI
   repita. Si no repite, la red no discrimina y lo dice.

   Uso:  npx electron . --remote-debugging-port=9222   y luego  node scratchpad/r346c-pingpong.mjs
   Codigos: 0 correcto · 1 fallo · 3 no medida (falta el material)
*/
import http from 'http';
import { existsSync } from 'fs';

const CLIP = 'C:/Users/beltr/Desktop/Alma Digital Studio/Projects/Immersive Studio Pro/scratchpad/media/tunel-control.mp4';
if (!existsSync(CLIP)) {
  console.log('   NO MEDIDA: falta ' + CLIP);
  console.log('   Se rehace con:  node scratchpad/r344-material.mjs');
  process.exit(3);
}

const lista = await new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9222, path: '/json/list' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const pg = lista.find(x => x.type === 'page' && x.webSocketDebuggerUrl && /index\.html/.test(x.url));
if (!pg) { console.log('*** la app no esta escuchando en 9222'); process.exit(2); }
const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const ev = x => new Promise(r => { const i = ++id; pend.set(i, m => r(m.result && m.result.exceptionDetails ? ('EXC ' + (m.result.exceptionDetails.exception?.description || '').slice(0, 400)) : (m.result && m.result.result && m.result.result.value))); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: x, awaitPromise: true, returnByValue: true, timeout: 150000 } })); });
const esperar = ms => new Promise(r => setTimeout(r, ms));

await ev(`(async()=>{ await newProject('dome',1024,1024,24,180,true); if(typeof hideLanding==='function')hideLanding(); })()`);
await esperar(1200);

const PAGINA = `(async()=>{
  let m=null, c=null, v0=null, upOrig=null;
  const restaurar=()=>{
    try{ if(upOrig)upTex=upOrig; }catch(e){}
    try{ _exCD=false; }catch(e){}
    try{ if(c)vinstDispose(c.id); }catch(e){}
    try{ if(m&&m.tex)gl.deleteTexture(m.tex); }catch(e){}
    try{ if(c){ const ic=state.clips.indexOf(c); if(ic>=0)state.clips.splice(ic,1); } }catch(e){}
    try{ if(m){ const im=state.media.indexOf(m); if(im>=0)state.media.splice(im,1); } }catch(e){}
    try{ if(v0){ v0.removeAttribute('src'); v0.load(); } }catch(e){}
    try{ renderMedia(); }catch(e){}
  };
  try{
  const RUTA=${JSON.stringify(CLIP)}, L=1.0;
  const dd=await demuxMP4(RUTA); const fps=dd.fps||24; try{dd.close();}catch(e){}
  const url=DSP.toFileURL(RUTA);
  v0=document.createElement('video'); v0.preload='metadata'; v0.src=url;
  await new Promise((res,rej)=>{ v0.addEventListener('loadedmetadata',()=>res()); v0.addEventListener('error',()=>rej(new Error('el medio no carga'))); });
  m={id:uid(),name:'r346c',kind:'video',el:v0,originalEl:v0,srcUrl:url,tex:newTex(),w:v0.videoWidth,h:v0.videoHeight,
    dur:v0.duration,fps:fps,color:clipColorFor('video'),proxyReady:false,proxyPct:0,path:RUTA,fsize:0,folder:null,missing:false,_loading:false};
  state.media.push(m); renderMedia();
  addClip(m,0,0); c=state.clips[state.clips.length-1];
  if(!c) throw new Error('no se creo el clip');
  /* Ping-pong con el ciclo pegado a fotograma, que es el caso normal y el unico en el que la regresion muerde */
  c.loop=true; c.loopRev=true; c.loopLen=L; c.inP=0; c.speed=1; c.start=0; c.dur=Math.max(c.dur, 3*L);

  upOrig=upTex; let ultimo=null;
  upTex=function(tex,src){ if(src&&typeof src.timestamp==='number')ultimo=src.timestamp; return upOrig.apply(this,arguments); };
  _exCD=true;   /* el camino del export: entrega por ClipDecoder, con sello de tiempo */

  const kDeUs=(us)=>us==null?null:Math.round(us/1e6*fps);
  /* El tramo cruza el vertice de arriba: con L=1 s el giro cae en t=1,0 exacto */
  const IS=[]; for(let i=20;i<=28;i++) IS.push(i/fps);

  const pasada=async(conTopeR346b)=>{
    vinstDispose(c.id); const ks=[];
    for(const t of IS){
      let local=srcT(c,t);
      if(conTopeR346b){ const ph=local-(c.inP||0); local=(c.inP||0)+Math.min(ph, L-2*TOL_DECOD); }   /* reconstruye la linea de R346b */
      ultimo=null;
      await vinstSeek(c,m,local);
      ks.push(kDeUs(ultimo)); }
    return ks; };

  const repes=(ks)=>{ let n=0; for(let i=1;i<ks.length;i++) if(ks[i]!=null&&ks[i]===ks[i-1])n++; return n; };
  const nulos=(ks)=>ks.filter(x=>x==null).length;

  const ahora=await pasada(false), r346b=await pasada(true);
  return JSON.stringify({fps:+fps.toFixed(3), L:L, ahora:ahora, r346b:r346b,
    repAhora:repes(ahora), repR346b:repes(r346b), nulAhora:nulos(ahora), nulR346b:nulos(r346b)});
}catch(e){ return 'ERR '+String((e&&e.message)||e).slice(0,300);
} finally { try{ restaurar(); }catch(e){} } })()`;

console.log('');
console.log('R346c - el giro del ping-pong no repite fotograma');
const r = await ev(PAGINA);
let o = null;
try { o = JSON.parse(r); } catch (e) { console.log('   *** ' + String(r).slice(0, 400)); ws.close(); process.exit(1); }

const malas = [];
console.log('   ' + o.fps + ' fps · ciclo de ' + o.L + ' s · instantes 20..28');
console.log('      AHORA (espejo exacto):        ' + o.ahora.join(',') + '   -> ' + o.repAhora + ' repetidos');
console.log('      con el tope de R346b:         ' + o.r346b.join(',') + '   -> ' + o.repR346b + ' repetidos');

if (o.nulAhora) malas.push(o.nulAhora + ' instantes sin fotograma entregado: la red no ha medido');
if (o.repAhora) malas.push('el giro REPITE ' + o.repAhora + ' fotograma(s) — es la meseta de R346b, mirar `srcT`');
if (!o.repR346b) malas.push('la red NO SABE FALLAR: reconstruido el tope de R346b, el giro sigue sin repetir');

console.log('');
for (const x of malas) console.log('   *** ' + x);
if (!malas.length) console.log('   OK - el espejo exacto no repite, y el tope de R346b vuelve a repetir ' + o.repR346b + '.');
ws.close();
process.exitCode = malas.length ? 1 : 0;
