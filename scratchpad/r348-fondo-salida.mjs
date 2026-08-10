/* [R348] Cuantos VideoFrames se pueden RETENER antes de que el decodificador deje de emitir.

   Por que: `docs/NEXT.md` lleva aparcada una optimizacion con arreglo propuesto —"cuando el clip esta en bucle
   y `loopLen*fps <= CAP`, ensanchar BEHIND para que el bucle entero quepa"— y eso es EXACTAMENTE lo que R257
   implemento y midio que fallaba: "retener los fotogramas del tramo volvio a producir la rendicion, 980
   ms/fotograma; cada VideoFrame retenido ocupa una plaza del FONDO DE SALIDA del decodificador, y reteniendo un
   ciclo entero no queda ninguna libre para emitir" (PLAN.md, ROUND 257). O sea que la cola propone algo que ya
   esta medido como imposible, y lleva ahi desde entonces invitando a reimplementarlo.

   Antes de cerrarlo hay que comprobar la equivalencia, no suponerla: ensanchar BEHIND retiene los fotogramas en
   la CACHE del ClipDecoder, y R257 los retenia en un conjunto aparte. El efecto sobre el fondo de salida
   deberia ser el mismo -son los mismos objetos VideoFrame sin cerrar- pero eso es un razonamiento. La medida
   que lo zanja es la capacidad del fondo, y no depende de nada de la app: se alimenta un `VideoDecoder` crudo y
   se cuentan los fotogramas que llegan SIN CERRARLOS, hasta que deja de emitir.

   El numero manda sobre la propuesta:
     · si el fondo aguanta menos que un ciclo tipico (12 fotogramas), la propuesta esta muerta y se cierra con
       la medida, no con una opinion;
     · si aguanta de sobra para fotogramas pequenos, la propuesta se puede salvar acotandola por tamano, que es
       lo que la propia nota exige.

   Control en el mismo banco: la misma alimentacion CERRANDO cada fotograma tiene que seguir hasta el final. Si
   tambien se para, el que falla es el arnes y la medida no dice nada del fondo.

   Uso:  npx electron . --remote-debugging-port=9222   y luego  node scratchpad/r348-fondo-salida.mjs
*/
import http from 'http';
import { existsSync } from 'fs';

const S = 'C:/Users/beltr/Desktop/Alma Digital Studio/Projects/Immersive Studio Pro/scratchpad/media/';
const RITO = 'C:/Users/beltr/Desktop/Rito Movie/Asset/Creation/';
const ARCHIVOS = [
  { n: 'tunel-control.mp4  (960x960, H.264)', p: S + 'tunel-control.mp4' },
  { n: 'gop240-60fps.mp4   (2560x1440, H.264)', p: S + 'gop240-60fps.mp4' },
  { n: 'o1.mp4             (2560x1440, H.264, material real)', p: RITO + 'o1.mp4' },
].filter(a => existsSync(a.p));
if (!ARCHIVOS.length) { console.log('   NO MEDIDA: no hay material'); process.exit(3); }

const lista = await new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9222, path: '/json/list' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const pg = lista.find(x => x.type === 'page' && /index\.html/.test(x.url));
if (!pg) { console.log('*** la app no esta escuchando en 9222'); process.exit(2); }
const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const ev = x => new Promise(r => { const i = ++id; pend.set(i, m => r(m.result && m.result.exceptionDetails ? ('EXC ' + (m.result.exceptionDetails.exception?.description || '').slice(0, 400)) : (m.result && m.result.result && m.result.result.value))); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: x, awaitPromise: true, returnByValue: true, timeout: 150000 } })); });

const PAGINA = (ruta) => `(async()=>{ let d=null; const abiertos=[]; try{
  const RUTA=${JSON.stringify(ruta)}, TOPE=40, QUIETO=1500;
  d=await demuxMP4(RUTA);
  const orden=d.samples.map((s,i)=>i).sort((a,b)=>d.samples[a].dts-d.samples[b].dts);

  /* Una pasada: alimenta muestras en orden de decodificacion y cuenta salidas. Si retener=true, NO se cierra
     ningun fotograma; si no, se cierra en cuanto llega (el control). Se para cuando pasan QUIETO ms sin una
     salida nueva habiendo entrada pendiente, o al llegar a TOPE. */
  const pasada=async(retener)=>{
    let salidas=0, ultima=performance.now(), err=null, dec=null;
    const mios=[];
    dec=new VideoDecoder({ output:(f)=>{ salidas++; ultima=performance.now();
        if(retener){ mios.push(f); } else { try{f.close();}catch(e){} } },
      error:(e)=>{ err=String(e&&e.message||e); } });
    dec.configure({codec:d.codec, description:d.description, codedWidth:d.codedWidth, codedHeight:d.codedHeight,
      hardwareAcceleration:'no-preference', optimizeForLatency:false});
    let i=0, alimentadas=0;
    while(salidas<TOPE && i<orden.length && !err){
      /* No se alimenta a ciegas: si la cola de entrada esta llena, se espera. Asi el estancamiento que se mide
         es del fondo de SALIDA, no de haber saturado la de entrada. */
      if(dec.decodeQueueSize>8){ await new Promise(r=>setTimeout(r,4));
        if(performance.now()-ultima>QUIETO) break; continue; }
      const idx=orden[i]; const s=d.samples[idx]; i++;
      const buf=await d.readSample(idx);
      try{ dec.decode(new EncodedVideoChunk({type:s.key?'key':'delta', timestamp:Math.round(s.ptsExact), data:buf})); alimentadas++; }
      catch(e){ err='decode: '+String(e&&e.message||e); break; }
    }
    /* Se le da tiempo a vaciar la cola antes de declarar el estancamiento. */
    while(!err && salidas<TOPE && performance.now()-ultima<QUIETO) await new Promise(r=>setTimeout(r,10));
    const res={salidas:salidas, alimentadas:alimentadas, cola:dec.decodeQueueSize, err:err,
               llegoAlTope:salidas>=TOPE};
    if(retener) abiertos.push(...mios); else { for(const f of mios){ try{f.close();}catch(e){} } }
    try{ dec.close(); }catch(e){}
    return res; };

  const conRetener=await pasada(true);
  /* Los retenidos se sueltan ANTES del control: si no, el control mediria un fondo ya ocupado. */
  for(const f of abiertos){ try{f.close();}catch(e){} } abiertos.length=0;
  await new Promise(r=>setTimeout(r,200));
  const control=await pasada(false);

  return JSON.stringify({w:d.codedWidth, h:d.codedHeight, codec:d.codec, muestras:d.samples.length,
    retener:conRetener, control:control});
}catch(e){ return 'ERR '+String((e&&e.message)||e).slice(0,300);
} finally { for(const f of abiertos){ try{f.close();}catch(e){} } try{ d&&d.close(); }catch(e){} } })()`;

console.log('');
console.log('R348 - capacidad del fondo de salida del decodificador (VideoFrames retenidos sin cerrar)');
console.log('       la propuesta aparcada necesita retener un ciclo entero: 12 fotogramas para el caso de R261');
const malas = [];
for (const a of ARCHIVOS) {
  const r = await ev(PAGINA(a.p));
  let o = null; try { o = JSON.parse(r); } catch (e) { console.log(''); console.log('   ' + a.n); console.log('   *** ' + String(r).slice(0, 400)); continue; }
  console.log('');
  console.log('   ' + a.n + '   ' + o.w + 'x' + o.h + ' · ' + o.codec + ' · ' + o.muestras + ' muestras');
  const R = o.retener, C = o.control;
  console.log('      RETENIENDO (sin cerrar): ' + R.salidas + ' fotogramas emitidos' + (R.llegoAlTope ? ' (llego al tope de la prueba, 40)' : ' y SE PARO') +
    '  · alimentadas ' + R.alimentadas + ' · cola ' + R.cola + (R.err ? ' · error: ' + R.err : ''));
  console.log('      CONTROL (cerrando):      ' + C.salidas + ' fotogramas emitidos' + (C.llegoAlTope ? ' (llego al tope)' : ' y SE PARO') +
    '  · alimentadas ' + C.alimentadas + ' · cola ' + C.cola + (C.err ? ' · error: ' + C.err : ''));
  if (!C.llegoAlTope) malas.push(a.n + ': el CONTROL tambien se paro — el arnes no mide el fondo de salida, la cifra de arriba no dice nada');
  else if (R.llegoAlTope) console.log('      -> el fondo aguanta al menos 40 retenidos: la propuesta NO muere por aqui');
  else console.log('      -> el fondo se agota en ' + R.salidas + ' retenidos' + (R.salidas < 12 ? '  <<< POR DEBAJO del ciclo de 12 que la propuesta necesita' : ''));
}
console.log('');
for (const x of malas) console.log('   *** ' + x);
ws.close();
process.exitCode = malas.length ? 1 : 0;
