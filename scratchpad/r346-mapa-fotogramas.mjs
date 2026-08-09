/* [R346] El mapa fotograma-de-salida -> fotograma-de-fuente en un export 1:1, medido sobre las APIs de verdad.

   El bucle del export pide `t = t0 + i/fps` (tres sitios: MP4, secuencia PNG y HAP) y `srcT` lo pasa a tiempo
   local. Cuando la cadencia de salida es la de la fuente -un master a la cadencia del material, lo normal- eso
   cae EXACTAMENTE en el comienzo de cada fotograma, y ahi los dos caminos entregan el fotograma ANTERIOR:
   `keyForTime` compara contra `Math.floor(t_us)` y Chromium trunca igual por dentro, mientras que el pts de
   verdad tiene microsegundos fraccionarios (55/24 s = 2291666,667 us). `i/fps` acierta cuando es exacto en
   binario (21/24 = 0,875) y falla cuando no.

   CRITERIO SIN ORACULO -y por eso esto se ve y las comparaciones anteriores no-: en un tramo seguido de un
   export 1:1, los fotogramas entregados tienen que ir de uno en uno. Ni repetidos ni saltados. No hace falta
   saber cual es "el correcto": basta con que la sucesion sea consecutiva. (El indice absoluto NO sirve de
   criterio: un archivo con edit list empieza en otro sitio a proposito, y `tunel-elst` lo demuestra.)

   Se comparan cuatro formas de pedir el instante, sin tocar app.js todavia:
     · como hoy:  t
     · centro:    el centro del fotograma segun `fps`  -> arreglo que ASUME rejilla uniforme (ojo con 59,94)
     · +0,5 us / +1 us / +2 us:  tolerancia en TIEMPO, que no asume cadencia ninguna
   Para el ClipDecoder, pasarle `tus+e` es exactamente lo que haria cambiar su comparacion interna, porque
   `keyForTime` hace `Math.floor` sobre lo que se le da.

   Uso:  npx electron . --remote-debugging-port=9222   y luego  node scratchpad/r346-mapa-fotogramas.mjs
*/
import http from 'http';
import { existsSync } from 'fs';

const S = 'C:/Users/beltr/Desktop/Alma Digital Studio/Projects/Immersive Studio Pro/scratchpad/media/';
const ARCHIVOS = [
  { n: 'tunel-control.mp4  (24 fps, edit list de 2 fotogramas)', p: S + 'tunel-control.mp4' },
  { n: 'gop240-60fps.mp4   (60 fps, sin edit list)', p: S + 'gop240-60fps.mp4' },
  { n: 'tunel-elst.mp4     (24 fps, edit list de 14 fotogramas)', p: S + 'tunel-elst.mp4' },
];
const faltan = ARCHIVOS.filter(a => !existsSync(a.p));
if (faltan.length) { console.log('   NO MEDIDA: falta ' + faltan.map(a => a.p).join(', ') + ' (node scratchpad/r344-material.mjs)'); process.exit(3); }

const lista = await new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9222, path: '/json/list' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const pg = lista.find(x => x.type === 'page' && /index\.html/.test(x.url));
if (!pg) { console.log('*** la app no esta escuchando en 9222'); process.exit(2); }
const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const ev = x => new Promise(r => { const i = ++id; pend.set(i, m => r(m.result && m.result.exceptionDetails ? ('EXC ' + (m.result.exceptionDetails.exception?.description || '').slice(0, 400)) : (m.result && m.result.result && m.result.result.value))); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: x, awaitPromise: true, returnByValue: true, timeout: 150000 } })); });

const PAGINA = (ruta) => `(async()=>{ let cd=null, v=null; try{
  const RUTA=${JSON.stringify(ruta)}, I0=90, NUM=40;
  const d=await demuxMP4(RUTA); const fps=d.fps||24;
  const disp=d.samples.map(s=>s.ptsExact).slice().sort((a,b)=>a-b); const N=disp.length;
  const kDePts=(pts)=>{ let mejor=0, dd=Infinity; for(let i=0;i<N;i++){ const x=Math.abs(disp[i]-pts); if(x<dd){dd=x;mejor=i;} } return mejor; };
  cd=makeClipDecoder(d,true);
  v=document.createElement('video'); v.src=DSP.toFileURL(RUTA); v.muted=true; v.playsInline=true; v.preload='auto';
  await new Promise((res,rej)=>{ v.onloadeddata=()=>res(); v.onerror=()=>rej(new Error('el <video> no carga')); });
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

  const FORMAS=[
    ['como hoy      ', (t)=>t],
    ['centro (fps)  ', (t)=>(Math.floor((t+1e-9)*fps)+0.5)/fps],
    ['+0,5 us       ', (t)=>t+0.5e-6],
    ['+1 us         ', (t)=>t+1e-6],
    ['+2 us         ', (t)=>t+2e-6],
  ];
  const medir=async(fn)=>{
    const cds=[], vids=[];
    for(let i=I0;i<I0+NUM && i<N-2;i++){
      const t=fn(i/fps);
      cds.push(await kCD(t*1e6));
      const meta=await seekRV(t); vids.push(meta?kDePts(meta.mediaTime*1e6):null); }
    /* consecutivo = de uno en uno. Repetido y saltado son las DOS formas de romperlo. */
    const cuenta=(arr)=>{ let rep=0, salt=0, atras=0;
      for(let j=1;j<arr.length;j++){ const p=arr[j-1], x=arr[j];
        if(x===p)rep++; else if(x<p)atras++; else if(x>p+1)salt+=x-p-1; }
      return {rep:rep, salt:salt, atras:atras}; };
    return {cd:cuenta(cds), vid:cuenta(vids), n:cds.length,
            difCdVid:cds.reduce((a,x,j)=>a+(x===vids[j]?0:1),0),
            ini:{cd:cds[0], vid:vids[0]}, muestraCd:cds.slice(0,12)}; };

  /* Y el CONTROL de no-desbordamiento: instantes ya bien situados no pueden cambiar de fotograma.
     [R346b] Se muestrea a un CUARTO y a tres cuartos del fotograma, no en el centro. En el centro la forma
     del centro es la identidad -floor((t+1e-9)*fps)+0,5 partido por fps devuelve la propia t-, asi que su 0
     estaba garantizado por construccion: el control no media nada justo para la forma que mas desplaza el
     instante (medio fotograma), que es contra la que existe. */
  const control=async(fn)=>{ let mov=0;
    for(let i=I0;i<I0+8;i++) for(const frac of [0.25,0.75]){ const t=(i+frac)/fps;
      const a=await kCD(t*1e6), b=await kCD(fn(t)*1e6); if(a!==b)mov++; }
    return mov; };

  const filas=[];
  for(const [nom,fn] of FORMAS){ const r=await medir(fn); r.nom=nom; r.control=await control(fn); filas.push(r); }
  return JSON.stringify({fps:+fps.toFixed(3), N:N, I0:I0, filas:filas});
}catch(e){ return 'ERR '+String((e&&e.message)||e).slice(0,300);
} finally { try{cd&&cd.close();}catch(e){} try{ if(v){v.removeAttribute('src');v.load();} }catch(e){} } })()`;

console.log('');
console.log('R346 - export 1:1: un tramo seguido tiene que entregar fotogramas consecutivos');
const total = {};
for (const a of ARCHIVOS) {
  const r = await ev(PAGINA(a.p));
  let o = null; try { o = JSON.parse(r); } catch (e) { console.log(''); console.log('   ' + a.n); console.log('   *** ' + String(r).slice(0, 400)); continue; }
  console.log('');
  console.log('   ' + a.n + '   ' + o.fps + ' fps · tramo de ' + o.filas[0].n + ' fotogramas desde el ' + o.I0);
  for (const f of o.filas) {
    const mal = f.cd.rep + f.cd.salt + f.cd.atras + f.vid.rep + f.vid.salt + f.vid.atras;
    total[f.nom] = (total[f.nom] || 0) + mal + (f.difCdVid ? 1000 : 0) + (f.control ? 1000 : 0);
    console.log('      ' + f.nom + ' cd: ' + f.cd.rep + ' rep, ' + f.cd.salt + ' salt' + (f.cd.atras ? ', ' + f.cd.atras + ' ATRAS' : '') +
      '  |  vid: ' + f.vid.rep + ' rep, ' + f.vid.salt + ' salt' + (f.vid.atras ? ', ' + f.vid.atras + ' ATRAS' : '') +
      '  |  difieren ' + f.difCdVid + '  |  control ' + (f.control ? '*** MUEVE ' + f.control : 'ok') +
      (mal === 0 ? '   <== consecutivo' : ''));
  }
  console.log('         como hoy, los 12 primeros:  ' + o.filas[0].muestraCd.join(','));
}
console.log('');
console.log('   TOTAL de roturas por forma (0 = perfecto en los tres archivos; +1000 = los caminos difieren o el control se mueve):');
for (const k of Object.keys(total)) console.log('      ' + k + '  ' + total[k]);
ws.close();
