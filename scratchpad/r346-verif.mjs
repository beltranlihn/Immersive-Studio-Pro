/* [R346] RED: un export 1:1 entrega fotogramas consecutivos, por los DOS caminos.

   El fallo que cierra: el bucle del export pide `t = t0 + i/fps`, y cuando la cadencia de salida es la de la
   fuente eso cae en el comienzo exacto de cada fotograma. Ahi tanto `keyForTime` (que compara contra
   `Math.floor(t_us)`) como Chromium por dentro se iban al fotograma ANTERIOR siempre que `i/fps` no fuese
   exacto en binario. Medido antes del arreglo, en un tramo seguido de 40 fotogramas a 24 fps: 13 repetidos y
   13 saltados. Un master que deberia ser fotograma a fotograma daba un tiron cada tres.

   CRITERIO SIN ORACULO, que es lo unico que lo caza: los dos caminos se equivocaban EN LO MISMO -0 diferencias
   entre ellos en 54 comparaciones-, asi que enfrentar el ClipDecoder con <video> sale "identico bit a bit", que
   es justo lo que concluyo R189. Aqui no se compara con nada: en un tramo seguido de un export 1:1 los
   fotogramas entregados tienen que ir DE UNO EN UNO.
     · camino ClipDecoder: se lee el `timestamp` del VideoFrame que el codigo sube a la textura (se envuelve
       `upTex`, o sea se observa la llamada de verdad; no se recalcula la regla por fuera).
     · camino <video> (el repliegue de `_cdFail`): un VideoFrame no hay, asi que el juez son los PIXELES —
       una fuente en movimiento no puede entregar dos fotogramas consecutivos identicos.

   SABE FALLAR, y se comprueba en cada corrida: `vinstSeek` suma `TOL_DECOD` por dentro, asi que pedirle
   `t - TOL_DECOD` reconstruye EXACTAMENTE el estado anterior al arreglo sin tocar app.js. Si esa mitad no
   reproduce los repetidos, la red no esta midiendo nada y lo dice (codigo 1), en vez de aprobar en vacio.

   Uso:  npx electron . --remote-debugging-port=9222   y luego  node scratchpad/r346-verif.mjs
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

const FPS = 24, I0 = 90, NUM = 40;

await ev(`(async()=>{ await newProject('dome',1024,1024,${FPS},180,true); if(typeof hideLanding==='function')hideLanding(); })()`);
await esperar(1200);

const PAGINA = `(async()=>{ let restaurar=null; try{
  const RUTA=${JSON.stringify(CLIP)}, FPS=${FPS}, I0=${I0}, NUM=${NUM};
  /* --- el medio y su clip, como los crea la aplicacion --- */
  const url=DSP.toFileURL(RUTA);
  const v0=document.createElement('video'); v0.preload='metadata'; v0.src=url;
  await new Promise((res,rej)=>{ v0.addEventListener('loadedmetadata',()=>res()); v0.addEventListener('error',()=>rej(new Error('el medio no carga'))); });
  const m={id:uid(),name:'r346',kind:'video',el:v0,originalEl:v0,srcUrl:url,tex:newTex(),w:v0.videoWidth,h:v0.videoHeight,
    dur:v0.duration,fps:FPS,color:clipColorFor('video'),proxyReady:false,proxyPct:0,path:RUTA,fsize:0,folder:null,missing:false,_loading:false};
  state.media.push(m); renderMedia();
  addClip(m,0,0); const c=state.clips[state.clips.length-1];
  if(!c) throw new Error('no se creo el clip');

  /* --- observar la llamada de VERDAD: que VideoFrame sube el codigo a la textura --- */
  const upOrig=upTex; let ultimo=null, vistas=0;
  upTex=function(tex,src){ vistas++; if(src&&typeof src.timestamp==='number')ultimo=src.timestamp; return upOrig.apply(this,arguments); };
  restaurar=()=>{ upTex=upOrig; };

  const lienzo=document.createElement('canvas'); lienzo.width=240; lienzo.height=135;
  const cx=lienzo.getContext('2d',{willReadFrequently:true});
  const pixDe=(el)=>{ cx.clearRect(0,0,240,135); cx.drawImage(el,0,0,240,135); return cx.getImageData(0,0,240,135).data; };
  const dif=(a,b)=>{ let s=0; for(let i=0;i<a.length;i+=4)s+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]); return s/(a.length/4*3); };

  /* --- camino ClipDecoder, que es el del export --- */
  const porDecodificador=async(cancelarTol)=>{
    m._cdFail=false; for(const [k] of _vinst) vinstDispose(k);
    _exCD=true;
    const sellos=[];
    try{
      for(let i=I0;i<I0+NUM;i++){
        const t=i/FPS; ultimo=null;
        await vinstSeek(c,m,cancelarTol?(t-TOL_DECOD):t);
        sellos.push(ultimo); }
    } finally { _exCD=false; }
    return sellos; };

  /* --- camino <video>, el repliegue: sin VideoFrame, juzgan los pixeles --- */
  const porVideo=async(cancelarTol)=>{
    for(const [k] of _vinst) vinstDispose(k);
    m._cdFail=true;                                   /* exactamente lo que marca el repliegue en produccion */
    const vs=[];
    for(let i=I0;i<I0+NUM;i++){
      const t=i/FPS;
      await vinstSeek(c,m,cancelarTol?(t-TOL_DECOD):t);
      const vi=_vinst.get(c.id); if(!vi||!vi.vel) throw new Error('sin <video> en el repliegue');
      if(vi.cd) throw new Error('el repliegue no se activo: sigue habiendo ClipDecoder');
      vs.push(pixDe(vi.vel)); }
    m._cdFail=false;
    const difs=[]; for(let i=1;i<vs.length;i++) difs.push(dif(vs[i-1],vs[i]));
    return difs; };

  const cuentaSellos=(s)=>{ const dur=1e6/FPS; let rep=0, salt=0, nulos=0;
    for(let i=0;i<s.length;i++){ if(s[i]==null){nulos++;continue;}
      if(i>0&&s[i-1]!=null){ const d=(s[i]-s[i-1])/dur;
        if(Math.abs(d)<0.5)rep++; else if(d>1.5)salt+=Math.round(d)-1; } }
    return {rep:rep, salt:salt, nulos:nulos}; };

  const cdBien=await porDecodificador(false), cdMal=await porDecodificador(true);
  const vidBien=await porVideo(false),        vidMal=await porVideo(true);
  const iguales=(d)=>d.filter(x=>x<0.5).length;      /* dos consecutivos identicos = un fotograma repetido */
  const movMedio=vidBien.length?(vidBien.reduce((a,b)=>a+b,0)/vidBien.length):0;

  return JSON.stringify({ vistas:vistas, tol:TOL_DECOD,
    cd:{bien:cuentaSellos(cdBien), mal:cuentaSellos(cdMal)},
    vid:{bien:iguales(vidBien), mal:iguales(vidMal), n:vidBien.length, mov:+movMedio.toFixed(2)} });
}catch(e){ return 'ERR '+String((e&&e.message)||e).slice(0,300);
} finally { try{ if(restaurar)restaurar(); }catch(e){} try{ _exCD=false; }catch(e){} } })()`;

const r = await ev(PAGINA);
let o = null;
console.log('');
console.log('R346 - un export 1:1 entrega fotogramas consecutivos, por los dos caminos');
try { o = JSON.parse(r); } catch (e) { console.log('   *** ' + String(r).slice(0, 400)); ws.close(); process.exit(1); }

const malas = [];
if (!o.vistas) malas.push('no se observo NI UNA subida de textura: la red no ha medido nada');
if (!(o.tol > 0)) malas.push('TOL_DECOD es ' + o.tol + ': el arreglo no esta puesto');
if (o.vid.mov < 2) malas.push('el material no se mueve (' + o.vid.mov + '): el juez de pixeles no puede discriminar');

console.log('   tolerancia en el codigo: ' + (o.tol * 1e6).toFixed(1) + ' us · ' + o.vistas + ' subidas de textura observadas');
console.log('   ClipDecoder  ARREGLADO: ' + o.cd.bien.rep + ' repetidos, ' + o.cd.bien.salt + ' saltados' + (o.cd.bien.nulos ? ', ' + o.cd.bien.nulos + ' sin sello' : ''));
console.log('   ClipDecoder  cancelando la tolerancia (estado anterior): ' + o.cd.mal.rep + ' repetidos, ' + o.cd.mal.salt + ' saltados');
console.log('   <video>      ARREGLADO: ' + o.vid.bien + ' parejas identicas de ' + o.vid.n + '  (movimiento medio ' + o.vid.mov + ')');
console.log('   <video>      cancelando la tolerancia (estado anterior): ' + o.vid.mal + ' parejas identicas de ' + o.vid.n);

if (o.cd.bien.rep || o.cd.bien.salt) malas.push('ClipDecoder: el tramo NO es consecutivo (' + o.cd.bien.rep + ' rep, ' + o.cd.bien.salt + ' salt)');
if (o.cd.bien.nulos) malas.push('ClipDecoder: ' + o.cd.bien.nulos + ' instantes sin fotograma entregado');
if (o.vid.bien) malas.push('<video>: ' + o.vid.bien + ' parejas de fotogramas consecutivos IDENTICOS sobre material en movimiento');
/* La otra mitad: si el estado anterior no se reproduce, esta red no discrimina y no vale como red. */
if (!(o.cd.mal.rep || o.cd.mal.salt)) malas.push('la red NO SABE FALLAR: cancelando la tolerancia el ClipDecoder sigue consecutivo');
if (!o.vid.mal) malas.push('la red NO SABE FALLAR: cancelando la tolerancia el repliegue <video> no repite ni un fotograma');

console.log('');
for (const x of malas) console.log('   *** ' + x);
if (!malas.length) console.log('   OK - los dos caminos consecutivos, y los dos vuelven a fallar al cancelar la tolerancia.');
ws.close();
process.exitCode = malas.length ? 1 : 0;
