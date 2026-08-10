/* [R346] DIAGNOSTICO del repliegue <video> del export: donde esta la carrera, exactamente.

   El pendiente de `docs/NEXT.md` dice que `vinstSeekVideo` "fija currentTime, espera seeked y sube lo que
   haya: es una carrera con la presentacion". Eso es una HIPOTESIS, y R256 solo midio el sintoma (8 de 48
   parejas que deben repetirse no se repiten, a 34-51 dB, y cambian de pasada en pasada). Antes de tocar el
   codigo hay que saber si la hipotesis es cierta, porque el arreglo es distinto segun la causa:

   [R346b·c] Y aquellas 8 de 48 tienen una explicacion que cuadra: el `srcT` anterior a R256 da exactamente 8
   parejas distintas de 48, o sea el mismo numero y la misma forma, asi que lo mas probable es que las
   produjeran los dos fallos de `srcT` que R256 arreglo en su propia ronda, sobre una referencia capturada antes
   del arreglo — y el ticket se abrio despues del commit que lo arreglaba. OJO: eso es una RECONSTRUCCION, no
   una cita. La cabecera de `r256-aceptacion.mjs` dice que CAMINO de decodificacion uso la referencia y que
   arreglo del bloqueo faltaba, y no dice nada de que `srcT` habia en el arbol; R346b la cito como si lo
   dijera. El sintoma de aqui arriba se transcribe tal cual porque es lo que decia la nota que mando escribir
   esta sonda, no porque se haya confirmado que fuera del repliegue.

     (H1) PRESENTACION: `seeked` se dispara antes de que el fotograma nuevo este disponible para dibujar,
          asi que `drawImage`/`texImage2D` sube el ANTERIOR.  -> arreglo: esperar la presentacion (rVFC).
     (H2) FRONTERA DE FOTOGRAMA: el instante cae a un pelo por debajo del comienzo del fotograma que le toca
          y <video> entrega el ANTERIOR.                      -> arreglo: pedir el CENTRO del fotograma.
     (H3) CONCURRENCIA: con varios <video> posicionandose a la vez -que es lo que hace `seekExport`- alguno
          entrega el fotograma de otro instante.

   Instrumento principal: `mediaTime` de requestVideoFrameCallback, que dice QUE fotograma se ha presentado
   sin depender de los pixeles. Los pixeles quedan de segundo juez (y para poder decir "no discrimina").

   OJO, y por eso esto se reescribio: la primera version media el movimiento entre vecinos con `t+1/fps`, y
   `1 + 1/24 = 1.0416666666666665` cae UN ULP POR DEBAJO de `25/24 = 1.0416666666666667`, o sea en el mismo
   fotograma. Daba 0 de diferencia y "ninguna hipotesis se reproduce": un aprobado vacio de manual. Aqui se
   muestrea siempre en el CENTRO del fotograma, (k+0,5)/fps, salvo en la prueba de frontera, que es justo lo
   contrario a proposito.

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r346-video-carrera.mjs
*/
import http from 'http';
import { existsSync } from 'fs';

const S = 'C:/Users/beltr/Desktop/Alma Digital Studio/Projects/Immersive Studio Pro/scratchpad/media/';
const ARCHIVOS = [
  { n: 'tunel-control.mp4  (24 fps, GOP 48 = 2 s, MUCHO movimiento)', p: S + 'tunel-control.mp4' },
  { n: 'gop240-60fps.mp4   (60 fps, GOP 240 = 4 s, el seek mas caro)', p: S + 'gop240-60fps.mp4' },
];
const faltan = ARCHIVOS.filter(a => !existsSync(a.p));
if (faltan.length) {
  console.log('   NO MEDIDA: falta el material -> ' + faltan.map(a => a.p).join(', '));
  console.log('   Se rehace con:  node scratchpad/r344-material.mjs');
  process.exit(3);
}

const lista = await new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9222, path: '/json/list' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const pg = lista.find(x => x.type === 'page' && /index\.html/.test(x.url));
if (!pg) { console.log('*** la app no esta escuchando en 9222'); process.exit(2); }
const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const ev = x => new Promise(r => { const i = ++id; pend.set(i, m => r(m.result && m.result.exceptionDetails ? ('EXC ' + (m.result.exceptionDetails.exception?.description || '').slice(0, 400)) : (m.result && m.result.result && m.result.result.value))); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: x, awaitPromise: true, returnByValue: true, timeout: 150000 } })); });

const PAGINA = (ruta) => `(async()=>{ const vs=[]; try{
  const RUTA=${JSON.stringify(ruta)}, CW=320, CH=180, N_PAR=4;
  const d=await demuxMP4(RUTA); const fps=d.fps||24, fdur=1/fps; try{d.close();}catch(e){}
  const ctxN=()=>{ const c=document.createElement('canvas'); c.width=CW; c.height=CH; return c.getContext('2d',{willReadFrequently:true}); };
  const cx=ctxN();
  const nuevoV=async()=>{ const v=document.createElement('video'); v.src=DSP.toFileURL(RUTA); v.muted=true; v.playsInline=true; v.preload='auto';
    await new Promise((res,rej)=>{ v.onloadeddata=()=>res(); v.onerror=()=>rej(new Error('el <video> no carga '+RUTA)); }); vs.push(v); return v; };
  const v0=await nuevoV();
  const dur=v0.duration, nF=Math.floor(dur*fps);
  const pix=(v)=>{ cx.clearRect(0,0,CW,CH); cx.drawImage(v,0,0,CW,CH); return cx.getImageData(0,0,CW,CH).data; };
  const dif=(a,b)=>{ let s=0; for(let i=0;i<a.length;i+=4)s+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]); return s/(a.length/4*3); };
  const centro=(k)=>(k+0.5)/fps;                       /* el CENTRO del fotograma k: sin ambiguedad de frontera */
  /* EXACTAMENTE lo que hace vinstSeekVideo hoy: fijar, esperar 'seeked', subir lo que haya. */
  const seekA=(v,t)=>new Promise(res=>{ const on=()=>{ v.removeEventListener('seeked',on); res(); }; v.addEventListener('seeked',on); v.currentTime=t; });
  /* Con rVFC armado ANTES: dice si la presentacion llego antes o despues de 'seeked', y QUE fotograma es. */
  const seekRV=(v,t)=>new Promise(res=>{
    let meta=null, rvAntes=false, hechoS=false, listo=false;
    const fin=(via)=>{ if(listo)return; listo=true; res({meta:meta, rvAntes:rvAntes, via:via}); };
    const h=v.requestVideoFrameCallback((now,m)=>{ meta=m; if(!hechoS)rvAntes=true; if(hechoS)fin('rvfc'); });
    const on=()=>{ v.removeEventListener('seeked',on); hechoS=true;
      if(meta){ fin('seeked-con-rvfc-previo'); return; }
      const t0=performance.now(); const esperar=()=>{ if(meta){fin('rvfc');return;}
        if(performance.now()-t0>1500){ try{v.cancelVideoFrameCallback(h);}catch(e){} fin('sin-rvfc'); return; }
        setTimeout(esperar,2); }; esperar(); };
    v.addEventListener('seeked',on); v.currentTime=t; });
  const kDe=(mt)=>mt==null?null:Math.round(mt*fps);

  /* --- 0) ?discrimina el material? diferencia entre fotogramas CONSECUTIVOS, muestreados en su centro --- */
  const movs=[];
  for(const k of [24, 60, 96]){ if(k+1>=nF) continue;
    await seekA(v0,centro(k)); const a=pix(v0); await seekA(v0,centro(k+1)); movs.push(+dif(a,pix(v0)).toFixed(2)); }

  /* --- 1) H1: ?cambia el pixel entre 'seeked' y la presentacion? --- */
  const ks=[]; for(let i=1;i<=8;i++){ const k=Math.floor(nF*i/9); if(k>0&&k<nF-1) ks.push(k); }
  const h1=[];
  for(const k of ks){
    await seekA(v0, centro(2));                                  /* lejos: el siguiente es un seek de verdad */
    const t=centro(k);
    let antes=null;
    const on=()=>{ v0.removeEventListener('seeked',on); antes=pix(v0); };  /* lo que subiria el codigo de HOY */
    v0.addEventListener('seeked',on);
    const r=await seekRV(v0,t);
    v0.removeEventListener('seeked',on);
    const despues=pix(v0);
    h1.push({ k:k, via:r.via, rvAntes:r.rvAntes, kPresentado:kDe(r.meta?r.meta.mediaTime:null),
              dif:(antes?+dif(antes,despues).toFixed(3):null) }); }

  /* --- 2) H2: la FRONTERA. El mismo fotograma pedido de cinco maneras que difieren en un pelo --- */
  const h2=[];
  for(const k of ks.slice(0,4)){
    const b=k/fps;                                                /* comienzo exacto del fotograma k */
    let acum=0; for(let i=0;i<k;i++) acum+=fdur;                  /* el mismo instante por ACUMULACION (lo que hace un bucle) */
    const casos=[['exacto k/fps',b], ['un ULP menos',b-Math.pow(2,-52)*b], ['acumulado',acum],
                 ['-1e-9',b-1e-9], ['centro',centro(k)]];
    const fila={k:k, casos:[]};
    for(const [nom,t] of casos){ await seekA(v0,centro(2)); const r=await seekRV(v0,t);
      fila.casos.push({nom:nom, t:t, kPres:kDe(r.meta?r.meta.mediaTime:null)}); }
    h2.push(fila); }

  /* --- 3) determinismo del camino de HOY: 3 pasadas, en distinto orden, centros de fotograma --- */
  const orden=(p)=>{ const a=ks.slice(); for(let i=a.length-1;i>0;i--){ const j=(i*7+p*13+3)%(i+1); const x=a[i]; a[i]=a[j]; a[j]=x; } return a; };
  const ref=new Map(); let seqMalos=0, seqPeor=0;
  for(let p=0;p<3;p++) for(const k of orden(p)){
    await seekA(v0, p%2 ? centro(1) : centro(nF-2));
    await seekA(v0, centro(k)); const px=pix(v0);
    if(!ref.has(k)) ref.set(k,px);
    else { const dd=dif(ref.get(k),px); if(dd>0.5){ seqMalos++; if(dd>seqPeor)seqPeor=dd; } } }

  /* --- 4) H3: cuatro elementos a la vez, que es lo que pide seekExport en cada fotograma --- */
  for(let i=1;i<N_PAR;i++) await nuevoV();
  let parMalos=0, parPeor=0; const parDet=[];
  for(const k of ks){
    await Promise.all(vs.map(v=>seekA(v,centro(2))));
    await Promise.all(vs.map(v=>seekA(v,centro(k))));             /* los cuatro a la vez, como en el export */
    const px=vs.map(v=>pix(v));
    for(let i=1;i<px.length;i++){ const dd=dif(px[0],px[i]);
      if(dd>0.5){ parMalos++; if(dd>parPeor)parPeor=dd; if(parDet.length<6) parDet.push({k:k,elem:i,dif:+dd.toFixed(2)}); } } }

  return JSON.stringify({ fps:+fps.toFixed(3), dur:+dur.toFixed(3), nF:nF, movs:movs, h1:h1, h2:h2,
    seq:{malos:seqMalos, peor:+seqPeor.toFixed(2), total:ks.length*2},
    par:{malos:parMalos, peor:+parPeor.toFixed(2), total:ks.length*(N_PAR-1), det:parDet} });
}catch(e){ return 'ERR '+String((e&&e.message)||e).slice(0,300);
} finally { for(const v of vs){ try{ v.removeAttribute('src'); v.load(); }catch(e){} } } })()`;

console.log('');
console.log('R346 - donde esta la carrera del repliegue <video> del export');
const confirmadas = new Set();
for (const a of ARCHIVOS) {
  const r = await ev(PAGINA(a.p));
  let o = null; try { o = JSON.parse(r); } catch (e) { console.log(''); console.log('   ' + a.n); console.log('   *** ' + String(r).slice(0, 400)); continue; }
  console.log('');
  console.log('   ' + a.n);
  const discrimina = Math.max(...o.movs) >= 2;
  console.log('      ' + o.fps + ' fps · ' + o.dur + ' s · ' + o.nF + ' fotogramas · diferencia entre CONSECUTIVOS: ' + o.movs.join(' / ') +
    (discrimina ? '' : '   [POCO MOVIMIENTO: no discrimina, lo de abajo no prueba nada]'));

  const sinRV = o.h1.filter(x => x.via === 'sin-rvfc');
  const rvPrevio = o.h1.filter(x => x.rvAntes);
  const cambia = o.h1.filter(x => x.dif > 0.5);
  const malPres = o.h1.filter(x => x.kPresentado !== null && x.kPresentado !== x.k);
  console.log('      H1 presentacion:  rVFC llego en ' + (o.h1.length - sinRV.length) + '/' + o.h1.length +
    ' (antes de seeked en ' + rvPrevio.length + ') · el pixel CAMBIA tras seeked en ' + cambia.length + '/' + o.h1.length +
    (cambia.length ? '   <<< H1 CIERTA (peor ' + Math.max(...cambia.map(x => x.dif)) + ')' : ''));
  if (malPres.length) console.log('         *** fotograma presentado != pedido en ' + malPres.length + ': ' + malPres.slice(0, 5).map(x => 'k=' + x.k + '->' + x.kPresentado).join(', '));
  if (cambia.length && discrimina) confirmadas.add('H1');

  console.log('      H2 frontera de fotograma (que fotograma entrega <video> segun como se escriba el instante):');
  let h2mal = 0;
  for (const f of o.h2) {
    const linea = f.casos.map(c => c.nom + '=' + (c.kPres === null ? '?' : c.kPres)).join('  ');
    const mal = f.casos.filter(c => c.kPres !== null && c.kPres !== f.k && c.nom !== 'centro');
    h2mal += mal.length;
    console.log('         pedido el fotograma ' + String(f.k).padStart(4) + ':  ' + linea + (mal.length ? '   <<< ' + mal.length + ' devuelven otro' : ''));
  }
  if (h2mal) confirmadas.add('H2');
  console.log('      SECUENCIAL, 3 pasadas: ' + (o.seq.malos ? '*** ' + o.seq.malos + '/' + o.seq.total + ' distintos, peor dif ' + o.seq.peor : 'los ' + o.seq.total + ' repiten'));
  console.log('      H3 CUATRO A LA VEZ:    ' + (o.par.malos ? '*** ' + o.par.malos + '/' + o.par.total + ' distintos, peor dif ' + o.par.peor : 'los ' + o.par.total + ' repiten'));
  for (const x of o.par.det) console.log('         fotograma ' + x.k + '  elemento ' + x.elem + '  dif ' + x.dif);
  if (o.seq.malos) confirmadas.add('determinismo');
  if (o.par.malos) confirmadas.add('H3');
}
console.log('');
console.log(confirmadas.size ? '   CONFIRMADAS: ' + [...confirmadas].join(', ') : '   Ninguna hipotesis se reproduce en este banco.');
ws.close();
