/* [R346] Que fotograma elige CADA camino del export para el MISMO instante.

   `r346-video-carrera.mjs` descarto la hipotesis que llevaba escrita un ano en `docs/NEXT.md` (una carrera con
   la presentacion: rVFC llego ANTES de `seeked` en 8/8 y el pixel no cambio nunca) y confirmo otra: <video>
   entrega el fotograma k o el k-1 segun COMO ESTE ESCRITO el instante. Falta lo que decide el arreglo: si el
   ClipDecoder -el camino principal, el que hace la pelicula- elige lo mismo. Un master no puede cambiar de
   fotograma porque un medio se caiga al repliegue a mitad de export.

   Tres jueces sobre los mismos instantes, sin pixeles (nada de "poco movimiento"):
     · REGLA EXACTA: el fotograma que CONTIENE t, con los pts de presentacion del demuxador sin truncar.
       Es la definicion, y sirve de patron.
     · ClipDecoder: `frameNear(t*1e6).timestamp`, o sea lo que escribe hoy el master. Su `keyForTime` TRUNCA
       t a microsegundos enteros (`Math.floor`) antes de comparar, asi que puede quedarse corto por <1 us.
     · <video>: `mediaTime` de requestVideoFrameCallback, que dice que fotograma se presento de verdad.

   Y de cada instante, tres formas de escribirlo: el comienzo exacto del fotograma (que es lo que produce un
   export a la misma cadencia que la fuente), un pelo por debajo, y el centro del fotograma (el arreglo que se
   propone). Uso:  npx electron . --remote-debugging-port=9222   y luego  node scratchpad/r346-quien-elige.mjs
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
  const RUTA=${JSON.stringify(ruta)};
  const d=await demuxMP4(RUTA); const fps=d.fps||24;
  const disp=d.samples.map(s=>s.ptsExact).slice().sort((a,b)=>a-b);   /* pts de PRESENTACION, en us, sin truncar */
  const N=disp.length;
  /* REGLA EXACTA: el ultimo fotograma cuyo pts <= t (t en us, en coma flotante, sin Math.floor) */
  const kExacto=(tus)=>{ let lo=0,hi=N-1,res=0; while(lo<=hi){ const m=(lo+hi)>>1; if(disp[m]<=tus){res=m;lo=m+1;}else hi=m-1;} return res; };
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

  const filas=[];
  const KS=[]; for(let i=1;i<=6;i++){ const k=Math.floor(N*i/7); if(k>2&&k<N-2)KS.push(k); }
  for(const k of KS){
    const pts=disp[k];                                  /* el comienzo exacto del fotograma k, en us */
    const tb=pts/1e6;                                   /* como segundos: lo que llega a vinstSeek */
    const formas=[ ['frontera', tb], ['un pelo menos', tb-1e-9], ['centro', (pts+ (disp[k+1]!=null?disp[k+1]:pts+1e6/fps) )/2/1e6 ] ];
    const fila={k:k, pts:+pts.toFixed(1), formas:[]};
    for(const [nom,t] of formas){
      const tus=t*1e6;
      const ex=kExacto(tus);
      const cdk=await kCD(tus);
      await seekRV(0.02+2/fps);                          /* lejos, para forzar un seek de verdad */
      const meta=await seekRV(t);
      const vk=meta?kDePts(meta.mediaTime*1e6):null;
      fila.formas.push({nom:nom, ex:ex, cd:cdk, vid:vk});
    }
    filas.push(fila); }
  return JSON.stringify({fps:+fps.toFixed(3), N:N, filas:filas});
}catch(e){ return 'ERR '+String((e&&e.message)||e).slice(0,300);
} finally { try{cd&&cd.close();}catch(e){} try{ if(v){v.removeAttribute('src');v.load();} }catch(e){} } })()`;

console.log('');
console.log('R346 - que fotograma elige cada camino para el mismo instante');
console.log('       ex = la regla exacta (patron) · cd = ClipDecoder (lo que hace el master) · vid = <video> (el repliegue)');
const resumen = { cdVsEx: 0, vidVsEx: 0, cdVsVid: 0, total: 0, centroBien: 0, centroTotal: 0 };
for (const a of ARCHIVOS) {
  const r = await ev(PAGINA(a.p));
  let o = null; try { o = JSON.parse(r); } catch (e) { console.log(''); console.log('   ' + a.n); console.log('   *** ' + String(r).slice(0, 400)); continue; }
  console.log('');
  console.log('   ' + a.n + '   ' + o.fps + ' fps · ' + o.N + ' fotogramas');
  for (const f of o.filas) {
    const partes = f.formas.map(x => {
      const marca = (x.cd !== x.ex ? ' cd!' : '') + (x.vid !== x.ex ? ' vid!' : '');
      return x.nom + ': ex=' + x.ex + ' cd=' + x.cd + ' vid=' + x.vid + marca;
    });
    console.log('      fotograma ' + String(f.k).padStart(4) + '  |  ' + partes.join('  |  '));
    for (const x of f.formas) {
      resumen.total++;
      if (x.cd !== x.ex) resumen.cdVsEx++;
      if (x.vid !== x.ex) resumen.vidVsEx++;
      if (x.cd !== x.vid) resumen.cdVsVid++;
      if (x.nom === 'centro') { resumen.centroTotal++; if (x.vid === x.ex && x.cd === x.ex) resumen.centroBien++; }
    }
  }
}
console.log('');
console.log('   RESUMEN sobre ' + resumen.total + ' medidas:');
console.log('      el ClipDecoder se aparta de la regla exacta en ' + resumen.cdVsEx);
console.log('      <video> se aparta de la regla exacta en         ' + resumen.vidVsEx);
console.log('      los dos caminos NO COINCIDEN entre si en        ' + resumen.cdVsVid + '   <-- esto es lo que cambia el master al caer al repliegue');
console.log('      pidiendo el CENTRO del fotograma aciertan los dos: ' + resumen.centroBien + '/' + resumen.centroTotal);
ws.close();
