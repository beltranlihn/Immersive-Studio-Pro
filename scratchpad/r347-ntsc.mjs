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
/* Los tres NTSC son el caso; los dos ULTIMOS son el CONTROL en el otro sentido, y no son un adorno: el riesgo
   del arreglo de R347 es justo el contrario del fallo que cierra — que al dejar de redondear a entero, un
   material de 24 o 60 EXACTOS pase a detectarse como 23,976 o 59,94 y la rejilla derive al reves. */
const ARCHIVOS = [
  { n: 'ntsc-2397.mp4  (24000/1001 = 23,976)', p: S + 'ntsc-2397.mp4', canon: 24, ntsc: true },
  { n: 'ntsc-2997.mp4  (30000/1001 = 29,970)', p: S + 'ntsc-2997.mp4', canon: 30, ntsc: true },
  { n: 'ntsc-5994.mp4  (60000/1001 = 59,940)', p: S + 'ntsc-5994.mp4', canon: 60, ntsc: true },
  { n: 'tunel-control.mp4  (24 EXACTOS, control)', p: S + 'tunel-control.mp4', canon: 24, ntsc: false },
  { n: 'gop240-60fps.mp4   (60 EXACTOS, control)', p: S + 'gop240-60fps.mp4', canon: 60, ntsc: false },
];
const faltan = ARCHIVOS.filter(a => !existsSync(a.p));
if (faltan.length) {
  console.log('   NO MEDIDA: falta ' + faltan.map(a => a.p).join(', '));
  console.log('   Se fabrica con:  node scratchpad/r347-material-ntsc.mjs');
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
  const mm={fps:30};
  const detectado=await new Promise(res=>{ let listo=false;
    try{ detectFps(vd,mm,()=>{ if(!listo){listo=true;res(mm.fps);} }); }catch(e){ res(null); return; }
    vd.play().catch(()=>{});
    setTimeout(()=>{ if(!listo){listo=true;res(mm.fps);} }, 6000); });
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
      return {rep:rep,salt:salt,atras:atras,desf:desf}; };
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
     ES la real, asi que pedirle que desplace seria pedirle que fallara. */
  let c = null;
  if (a.ntsc) { const rC = await ev(PAGINA(a.p, a.canon)); try { c = JSON.parse(rC); } catch (e) { c = null; } }

  const detOk = Math.abs(o.detectado - o.fps) < 0.01;
  console.log('   ' + a.n + '   demuxador: ' + o.fps + ' fps · ' + o.N + ' fotogramas · tramo desde el ' + o.I0);
  console.log('      detectFps devuelve: ' + (Math.round(o.detectado * 1000) / 1000) + (detOk ? '   (la real)' : '   <<< CANONIZADO A ENTERO, el real es ' + o.fps));
  console.log('      P1 la tolerancia sobre la rejilla REAL:      cd ' + fila(o.res));
  console.log('         entregados, deberian ser ' + o.I0 + '..: ' + o.res.muestraCd.join(','));
  if (c) {
    console.log('      P2 control, con la rejilla ENTERA (i/' + a.canon + '):  cd ' + fila(c.res));
    console.log('         entregados, deberian ser ' + c.I0 + '..: ' + c.res.muestraCd.join(','));
  }

  /* P1 — lo que se afirma: la tolerancia no depende de la cadencia. */
  const r = o.res;
  if (r.cd.rep + r.cd.salt + r.cd.atras + r.cd.desf) malas.push(a.n + ' ClipDecoder: con la rejilla real el tramo no sale limpio (' + r.cd.rep + ' rep, ' + r.cd.salt + ' salt, ' + r.cd.atras + ' atras, ' + r.cd.desf + ' desplazados)');
  if (r.vid.rep + r.vid.salt + r.vid.desf) malas.push(a.n + ' <video>: con la rejilla real el tramo no sale limpio (' + r.vid.rep + ' rep, ' + r.vid.salt + ' salt, ' + r.vid.desf + ' desplazados)');
  if (r.difCdVid) malas.push(a.n + ': los dos caminos entregan fotogramas distintos en ' + r.difCdVid + ' instantes');
  /* Lo que arregla R347, y en los DOS sentidos: la cadencia detectada es la de verdad. En NTSC, que no la
     redondee al entero (la rejilla del proxy derivaria); en material de cadencia entera, que no se pase de
     listo y la baje a la NTSC vecina, que es el riesgo que introduce el propio arreglo. */
  if (!detOk) malas.push(a.n + ': detectFps devuelve ' + o.detectado + ' y la cadencia real es ' + o.fps +
    (a.ntsc ? ' — redondeada al entero: la rejilla del proxy deriva' : ' — el arreglo de R347 se ha pasado y estropea una cadencia ENTERA'));
  /* Y la comprobacion de que este banco DISCRIMINA: con la rejilla entera el desplazamiento tiene que verse.
     Si no se ve, el tramo medido no esta bastante lejos del principio y lo de arriba no prueba nada. */
  if (a.ntsc && c && !c.res.cd.desf) malas.push(a.n + ': el banco NO DISCRIMINA — ni con la rejilla entera aparece desplazamiento, el tramo medido esta demasiado cerca del principio');
}

console.log('');
for (const x of malas) console.log('   *** ' + x);
if (!malas.length) console.log('   OK - la tolerancia aguanta las tres cadencias NTSC, detectFps devuelve la real, y el control con la rejilla entera sigue desplazando.');
ws.close();
process.exitCode = malas.length ? 1 : 0;
