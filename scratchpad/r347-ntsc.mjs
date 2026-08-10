/* [R347] Las dos preguntas de NTSC que R346 dejo escritas y nadie midio.

   P1 - LA TOLERANCIA. `TOL_DECOD` = 2 us se eligio frente al centro del fotograma con este argumento: el centro
        exige una rejilla uniforme a `fps` y la tolerancia no depende de la cadencia. Es un argumento. Sobre
        23,976 / 29,97 / 59,94 no se ha probado nunca. Criterio, el mismo sin oraculo de R346: en un tramo
        seguido de un export 1:1 -o sea pidiendo `t = i/fps` con el fps REAL de la fuente- los fotogramas
        entregados van de uno en uno.

   P2 - LA REJILLA CANONIZADA. `detectFps` canoniza a {24,25,30,48,50,60,120} con tolerancia 1,2, asi que
        59,94 -> 60 y 23,976 -> 24. `makeProxy` construye su rejilla de seek con `m.fps`, y el error relativo de
        esa canonizacion es 1/1001: la deriva alcanza medio fotograma -el punto en el que se empieza a elegir
        otro fotograma- en 1001/(2*fps) segundos, o sea 8,3 s a 59,94. A partir de ahi el proxy hornea un
        fotograma que no es el que le toca, y ninguna tolerancia posterior lo recupera.

   Se mide EN TARDE a proposito (a partir del 60 % del archivo, bien pasada la frontera de la deriva): al
   principio las dos rejillas coinciden y cualquier medida ahi sale limpia sin probar nada.

   Los dos caminos, con los mismos instrumentos que las sondas de R346: el ClipDecoder por el `timestamp` del
   VideoFrame y <video> por el `mediaTime` de requestVideoFrameCallback. Sin pixeles, asi que la cadencia del
   material no tiene que discriminar nada.

   Uso:  npx electron . --remote-debugging-port=9222   y luego  node scratchpad/r347-ntsc.mjs
   Material: node scratchpad/r347-material-ntsc.mjs
*/
import http from 'http';
import { existsSync } from 'fs';

const S = 'C:/Users/beltr/Desktop/Alma Digital Studio/Projects/Immersive Studio Pro/scratchpad/media/';
/* Los tres NTSC son el caso; los CUATRO ultimos son el CONTROL en el otro sentido, y no son un adorno: el
   riesgo del arreglo es justo el contrario del fallo que cierra — que un material de 24 o 60 EXACTOS pase a
   detectarse como 23,976 o 59,94 y la rejilla derive al reves.
   [R347b] Y los dos de TIMEBASE GRUESO son los que hacian falta. Los otros dos controles tienen timebases que
   son multiplos exactos de su fotograma (12288/24=512, 15360/60=256), asi que la medida cae a 60 y 25 veces
   dentro de la frontera de decision y pasan POR CONSTRUCCION: no podian ponerse rojos. En milisegundos -lo que
   trae cualquier WebM/MKV y cualquier MP4 remuxeado de uno- un 24 exacto da mediana 42 ms y `1/md` = 23,8095,
   que cae MAS CERCA de 23,976 que de 24. Con estos dos dentro, la red se ponia roja el dia que se escribio. */
const ARCHIVOS = [
  { n: 'ntsc-2397.mp4  (24000/1001 = 23,976)', p: S + 'ntsc-2397.mp4', canon: 24, ntsc: true },
  { n: 'ntsc-2997.mp4  (30000/1001 = 29,970)', p: S + 'ntsc-2997.mp4', canon: 30, ntsc: true },
  { n: 'ntsc-5994.mp4  (60000/1001 = 59,940)', p: S + 'ntsc-5994.mp4', canon: 60, ntsc: true },
  /* `soloFps`: en estos dos el criterio de sucesion consecutiva NO aplica, y no por conveniencia. Un timebase de
     milisegundos no puede representar 1/24 ni 1/60, asi que los pts REALES del archivo no son uniformes (41/42
     ms alternos): el fotograma i no empieza en i/fps para ningun fps, luego ninguna rejilla uniforme puede dar
     1:1 y medirlo seria exigirle al codigo algo que el material no permite. Medido: sobre la cadencia media del
     demuxador salen 13 repetidos y 13 saltados, que es el archivo, no el arreglo. Lo que si es exigible -y es
     lo que protege la rejilla del proxy- es que la cadencia detectada sea el ENTERO. */
  { n: 'ms-24.mp4  (24 EXACTOS, timebase de ms — el caso que rompia)', p: S + 'ms-24.mp4', canon: 24, ntsc: false, soloFps: true },
  { n: 'ms-60.mp4  (60 EXACTOS, timebase de ms — el caso que rompia)', p: S + 'ms-60.mp4', canon: 60, ntsc: false, soloFps: true },
  /* [R347b] El PAL: hasta R347 se detectaba como 24 porque el `canon` viejo devolvia el PRIMER candidato dentro
     de 1,2 y 24 precede a 25. Un 4 % de error —cuarenta veces el de NTSC— y desde el commit inicial. Se arreglo
     de rebote al pasar a "el mas cercano", y sin este archivo nada impide que vuelva. */
  { n: 'pal-25.mp4  (25 EXACTOS: el que se detectaba como 24)', p: S + 'pal-25.mp4', canon: 25, ntsc: false },
  { n: 'tunel-control.mp4  (24 EXACTOS, timebase fino)', p: S + 'tunel-control.mp4', canon: 24, ntsc: false },
  { n: 'gop240-60fps.mp4   (60 EXACTOS, timebase fino)', p: S + 'gop240-60fps.mp4', canon: 60, ntsc: false },
];
const faltan = ARCHIVOS.filter(a => !existsSync(a.p));
if (faltan.length) {
  console.log('   NO MEDIDA: falta ' + faltan.map(a => a.p.replace(/^.*\//, '')).join(', '));
  /* [R347b] Las instrucciones, correctas: dos de los siete archivos NO salen del guion de R347. Decirlo mal
     dejaba al operador corriendo el guion que se le nombra y volviendo a sacar codigo 3, indefinidamente. */
  console.log('   Se fabrican con:  node scratchpad/r347-material-ntsc.mjs   (ntsc-* y ms-*)');
  console.log('                y:  node scratchpad/r344-material.mjs        (tunel-control.mp4, gop240-60fps.mp4)');
  process.exit(3);
}

const lista = await new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9222, path: '/json/list' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const pg = lista.find(x => x.type === 'page' && /index\.html/.test(x.url));
if (!pg) { console.log('*** la app no esta escuchando en 9222'); process.exit(2); }
const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const ev = x => new Promise(r => { const i = ++id; pend.set(i, m => r(m.result && m.result.exceptionDetails ? ('EXC ' + (m.result.exceptionDetails.exception?.description || '').slice(0, 400)) : (m.result && m.result.result && m.result.result.value))); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: x, awaitPromise: true, returnByValue: true, timeout: 150000 } })); });

/* `rejilla` = la cadencia con la que se construyen los instantes pedidos. `null` = la EXACTA del demuxador
   (P1: un export 1:1 de verdad); un numero = la canonizada por `detectFps` (P2: la rejilla del proxy). */
const PAGINA = (ruta, rejilla) => `(async()=>{ let cd=null, v=null, vd=null; try{
  const RUTA=${JSON.stringify(ruta)}, NUM=40, REJILLA=${rejilla === null ? 'null' : rejilla};
  const d=await demuxMP4(RUTA); const fps=d.fps;
  const disp=d.samples.map(s=>s.ptsExact).slice().sort((a,b)=>a-b); const N=disp.length;
  const kDePts=(pts)=>{ let mejor=0, dd=Infinity; for(let i=0;i<N;i++){ const x=Math.abs(disp[i]-pts); if(x<dd){dd=x;mejor=i;} } return mejor; };

  /* --- que dice detectFps, que es de donde sale la rejilla del generador de proxys --- */
  vd=document.createElement('video'); vd.src=DSP.toFileURL(RUTA); vd.muted=true; vd.playsInline=true; vd.preload='auto';
  await new Promise((res,rej)=>{ vd.onloadeddata=()=>res(); vd.onerror=()=>rej(new Error('no carga')); });
  /* [R347b] El testigo arranca en -1, no en 30. Con 30, "no se pudo medir" y "midio 30" eran LA MISMA lectura,
     porque 30 es un resultado valido -y detectFps deja m.fps intacto cuando calc devuelve 0-. Y el plazo sube
     por encima del suyo: el suyo es min(8000, 2500+mpx*800), que con el material de Beltran (7196x912 =
     6,56 Mpx) son 7748 ms, o sea que un plazo de 6000 leia el testigo antes de tiempo, mataba la medida en
     vuelo con un pause() y acusaba al codigo de un fallo que no tenia. */
  /* [R347b] CON la ruta puesta, como el medio de verdad: detectFps decide por el demuxador cuando la tiene, y un
     testigo sin ruta caia siempre al camino de reproduccion. La primera version de este control media el camino
     que no es y daba por roto el arreglo. */
  const mm={fps:-1, path:RUTA};
  const detectado=await new Promise(res=>{ let listo=false;
    try{ detectFps(vd,mm,()=>{ if(!listo){listo=true;res(mm.fps);} }); }catch(e){ res(null); return; }
    vd.play().catch(()=>{});
    setTimeout(()=>{ if(!listo){listo=true;res(null);} }, 12000); });
  try{ vd.pause(); }catch(e){}

  cd=makeClipDecoder(d,true);
  v=document.createElement('video'); v.src=DSP.toFileURL(RUTA); v.muted=true; v.playsInline=true; v.preload='auto';
  await new Promise((res,rej)=>{ v.onloadeddata=()=>res(); v.onerror=()=>rej(new Error('no carga')); });
  const seekRV=(t)=>new Promise(res=>{ let meta=null, listo=false;
    const fin=()=>{ if(listo)return; listo=true; res(meta); };
    const h=v.requestVideoFrameCallback((now,m)=>{ meta=m; });
    const on=()=>{ v.removeEventListener('seeked',on);
      const t0=performance.now(); const esperar=()=>{ if(meta){fin();return;}
        if(performance.now()-t0>1500){ try{v.cancelVideoFrameCallback(h);}catch(e){} fin(); return; }
        setTimeout(esperar,2); }; esperar(); };
    v.addEventListener('seeked',on); v.currentTime=t; });
  const kCD=async(tus)=>{ cd.setTarget(tus); const t0=performance.now();
    while(!cd.passed(tus)){ cd.pump(); await new Promise(r=>setTimeout(r,2));
      if(cd.isDead()) throw new Error('decodificador muerto');
      if(performance.now()-t0>10000) throw new Error('el decodificador no llega a '+tus); }
    const f=cd.frameNear(tus); if(!f) throw new Error('sin fotograma'); return kDePts(f.timestamp); };

  /* EN TARDE: al 60 % del archivo, bien pasada la frontera de deriva 1001/(2*fps) */
  const I0=Math.floor(N*0.6);
  const medir=async(fpsRejilla)=>{
    const cds=[], vids=[];
    for(let i=I0;i<I0+NUM && i<N-2;i++){
      const t=i/fpsRejilla;
      cds.push(await kCD(instanteDecod(t)*1e6));
      const meta=await seekRV(instanteDecod(t)); vids.push(meta?kDePts(meta.mediaTime*1e6):null); }
    const cuenta=(arr)=>{ let rep=0,salt=0,atras=0,desf=0;
      for(let j=0;j<arr.length;j++){ if(arr[j]!==I0+j)desf++;
        if(j>0&&arr[j]!=null&&arr[j-1]!=null){ const dd=arr[j]-arr[j-1];
          if(dd===0)rep++; else if(dd<0)atras++; else if(dd>1)salt+=dd-1; } }
      return {rep:rep,salt:salt,atras:atras,desf:desf,n:arr.length}; };
    return {cd:cuenta(cds), vid:cuenta(vids), muestraCd:cds.slice(0,10),
            difCdVid:cds.reduce((a,x,j)=>a+(x===vids[j]?0:1),0)}; };

  const res=await medir(REJILLA===null?fps:REJILLA);
  return JSON.stringify({fps:+fps.toFixed(6), N:N, I0:I0, detectado:detectado, res:res});
}catch(e){ return 'ERR '+String((e&&e.message)||e).slice(0,300);
} finally { try{cd&&cd.close();}catch(e){} try{ if(v){v.removeAttribute('src');v.load();} }catch(e){} try{ if(vd){vd.removeAttribute('src');vd.load();} }catch(e){} } })()`;

const fila = (x) => x.cd.rep + ' rep, ' + x.cd.salt + ' salt, ' + x.cd.atras + ' atras, ' + x.cd.desf + ' desplazados  |  vid ' +
  x.vid.rep + ' rep, ' + x.vid.salt + ' salt, ' + x.vid.desf + ' desplazados  |  difieren ' + x.difCdVid;

console.log('');
console.log('R347 - NTSC: la tolerancia y la cadencia detectada');
console.log('       desf = el fotograma entregado no es el que toca · rep/salt = la sucesion se rompe');
const malas = [];
for (const a of ARCHIVOS) {
  console.log('');
  const rE = await ev(PAGINA(a.p, null));
  let o = null;
  try { o = JSON.parse(rE); } catch (e) { console.log('   ' + a.n); console.log('   *** ' + String(rE).slice(0, 400)); malas.push(a.n + ': la sonda no llego a medir'); continue; }
  /* El control con la rejilla entera solo tiene sentido en NTSC: en un material de cadencia entera esa rejilla
     ES la real, asi que pedirle que desplace seria pedirle que fallara.
     [R347b] Y si esa segunda pasada FALLA, se dice. Antes el error se tragaba en `c = null` y todas las
     comprobaciones que dependen de el se saltaban con un `if (c)`, asi que la red imprimia OK y salia con 0
     habiendo desactivado en silencio su propio control de discriminacion. */
  let c = null;
  if (a.ntsc) {
    const rC = await ev(PAGINA(a.p, a.canon));
    try { c = JSON.parse(rC); } catch (e) { malas.push(a.n + ': la pasada de control (rejilla entera) no llego a medir -> ' + String(rC).slice(0, 160)); }
  }

  const detOk = o.detectado != null && Math.abs(o.detectado - o.fps) < 0.01;
  console.log('   ' + a.n + '   demuxador: ' + o.fps + ' fps · ' + o.N + ' fotogramas · tramo desde el ' + o.I0);
  console.log('      detectFps devuelve: ' + (o.detectado == null ? 'NO MIDIO (plazo agotado)' : (Math.round(o.detectado * 1000) / 1000)) + (detOk ? '   (la real)' : '   <<< NO ES LA REAL, que es ' + o.fps));
  console.log('      P1 la tolerancia sobre la rejilla REAL:      cd ' + fila(o.res));
  console.log('         entregados, deberian ser ' + o.I0 + '..: ' + o.res.muestraCd.join(','));
  if (c) {
    console.log('      P2 control, con la rejilla ENTERA (i/' + a.canon + '):  cd ' + fila(c.res));
    console.log('         entregados, deberian ser ' + c.I0 + '..: ' + c.res.muestraCd.join(','));
  }

  /* P1 — lo que se afirma: la tolerancia no depende de la cadencia. Sólo donde el material tiene una rejilla
     uniforme que la pueda sostener (ver `soloFps`). */
  const r = o.res;
  if (!a.soloFps) {
    if (r.cd.rep + r.cd.salt + r.cd.atras + r.cd.desf) malas.push(a.n + ' ClipDecoder: con la rejilla real el tramo no sale limpio (' + r.cd.rep + ' rep, ' + r.cd.salt + ' salt, ' + r.cd.atras + ' atras, ' + r.cd.desf + ' desplazados)');
    if (r.vid.rep + r.vid.salt + r.vid.desf) malas.push(a.n + ' <video>: con la rejilla real el tramo no sale limpio (' + r.vid.rep + ' rep, ' + r.vid.salt + ' salt, ' + r.vid.desf + ' desplazados)');
    if (r.difCdVid) malas.push(a.n + ': los dos caminos entregan fotogramas distintos en ' + r.difCdVid + ' instantes');
  }
  /* Lo que arregla R347, y en los DOS sentidos: la cadencia detectada es la de verdad. En NTSC, que no la
     redondee al entero (la rejilla del proxy derivaria); en material de cadencia entera, que no se pase de
     listo y la baje a la NTSC vecina, que es el riesgo que introduce el propio arreglo. */
  if (!detOk) malas.push(a.n + ': detectFps devuelve ' + o.detectado + ' y la cadencia real es ' + o.fps +
    (a.ntsc ? ' — redondeada al entero: la rejilla del proxy deriva' : ' — se ha pasado de listo y estropea una cadencia ENTERA'));
  /* [R347b] La comprobacion de que este banco DISCRIMINA. Antes exigia que el desplazamiento apareciera "lejos
     del principio", razonando con los `1001/(2*fps)` s del CENTRO del fotograma; sobre la rejilla de FRONTERA
     -que es la que se mide aqui- el desplazamiento empieza en el fotograma 1, asi que esa condicion no podia
     fallar nunca. Lo que si prueba algo: con la rejilla entera TODO el tramo tiene que salir desplazado. */
  if (a.ntsc && c && c.res.cd.desf < c.res.cd.n) malas.push(a.n + ': el banco NO DISCRIMINA — con la rejilla entera solo ' + c.res.cd.desf + ' de ' + c.res.cd.n + ' fotogramas salen desplazados, se esperaban todos');
}

console.log('');
for (const x of malas) console.log('   *** ' + x);
if (!malas.length) console.log('   OK - la tolerancia aguanta las tres cadencias NTSC, detectFps devuelve la real, y el control con la rejilla entera sigue desplazando.');
ws.close();
process.exitCode = malas.length ? 1 : 0;
