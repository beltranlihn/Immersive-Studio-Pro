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

   [R348b] AVISO, y sale de una corrida real: esta sonda RETIENE superficies de GPU a proposito, y despues de
   pasarla varias veces sobre la misma instancia `npm run redes` dio DOS rojos (`r346-verif` roja y `r347-ntsc`
   agotando su plazo de 180 s) que desaparecieron los dos al reiniciar la app. No es de las que se pueden dejar
   corriendo antes de las redes: se pasa en una instancia recien levantada, y se reinicia despues. Por eso NO
   esta en `correr-redes.mjs` — y no debe entrar.

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
    let salidas=0, ultima=performance.now(), err=null, dec=null, motivo='';
    dec=new VideoDecoder({ output:(f)=>{ salidas++; ultima=performance.now();
        /* [R348b] Los retenidos van a la lista exterior AL LLEGAR, no al final de la pasada. Antes se
           acumulaban en un array local y se entregaban a la limpieza despues del bucle: si readSample rechazaba
           a mitad -un descriptor cerrado, una lectura pasado el final, un error de disco-, la excepcion salia de
           aqui y el finally cerraba una lista vacia, dejando abiertas hasta 16 superficies de GPU para el resto
           de la sesion, justo las que la app necesita despues. */
        if(retener){ abiertos.push(f); } else { try{f.close();}catch(e){} } },
      error:(e)=>{ err=String(e&&e.message||e); } });
    /* [R348b] EXACTAMENTE la configuracion de la app -codec y description, nada mas-, que es lo que pasan los
       tres decodificadores que existen (el mkDec del ClipDecoder, el vdec de makeProxy y el del cache de
       fotogramas). La version anterior anadia codedWidth/codedHeight, hardwareAcceleration y
       optimizeForLatency, y son precisamente las pistas que eligen la implementacion y cuantos buferes de salida
       reserva: la cifra podia ser de un decodificador que la app no instancia nunca. Juez y acusado tienen que
       estar configurados igual. */
    dec.configure({codec:d.codec, description:d.description});
    let i=0, alimentadas=0;
    while(salidas<TOPE && i<orden.length && !err){
      /* No se alimenta a ciegas: si la cola de entrada esta llena, se espera. Asi el estancamiento que se mide
         es del fondo de SALIDA, no de haber saturado la de entrada. */
      if(dec.decodeQueueSize>8){ await new Promise(r=>setTimeout(r,4));
        if(performance.now()-ultima>QUIETO){ motivo='estancado'; break; } continue; }
      const idx=orden[i]; const s=d.samples[idx]; i++;
      const buf=await d.readSample(idx);
      try{ dec.decode(new EncodedVideoChunk({type:s.key?'key':'delta', timestamp:Math.round(s.ptsExact), data:buf})); alimentadas++; }
      catch(e){ err='decode: '+String(e&&e.message||e); break; }
    }
    /* [R348b] POR QUE termino el bucle, dicho aparte. Con solo el numero de salidas no se distinguia "el fondo
       se agoto" de "se acabaron las muestras": inocuo con el banco de hoy (193/600/600 contra un tope de 40),
       pero esta sonda esta escrita para reusarse y es el artefacto que una ronda futura citara para no tocar
       BEHIND. */
    if(!motivo){ if(err)motivo='error'; else if(salidas>=TOPE)motivo='tope'; else if(i>=orden.length)motivo='sin mas muestras'; }
    /* Se le da tiempo a vaciar la cola antes de declarar el estancamiento. */
    while(!err && salidas<TOPE && performance.now()-ultima<QUIETO) await new Promise(r=>setTimeout(r,10));
    if(salidas>=TOPE)motivo='tope'; else if(motivo!=='error'&&motivo!=='sin mas muestras')motivo='estancado';
    const res={salidas:salidas, alimentadas:alimentadas, cola:dec.decodeQueueSize, err:err, motivo:motivo,
               llegoAlTope:salidas>=TOPE};
    try{ dec.close(); }catch(e){}
    return res; };

  const conRetener=await pasada(true);
  /* Los retenidos se sueltan ANTES del control: si no, el control mediria un fondo ya ocupado. */
  for(const f of abiertos){ try{f.close();}catch(e){} } abiertos.length=0;
  await new Promise(r=>setTimeout(r,200));
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
  console.log('      RETENIENDO (sin cerrar): ' + R.salidas + ' fotogramas emitidos · termino por: ' + R.motivo +
    ' · alimentadas ' + R.alimentadas + ' · cola ' + R.cola + (R.err ? ' · error: ' + R.err : ''));
  console.log('      CONTROL (cerrando):      ' + C.salidas + ' fotogramas emitidos · termino por: ' + C.motivo +
    ' · alimentadas ' + C.alimentadas + ' · cola ' + C.cola + (C.err ? ' · error: ' + C.err : ''));
  if (!C.llegoAlTope) malas.push(a.n + ': el CONTROL no llego al tope (' + C.motivo + ') — el arnes no mide el fondo de salida, la cifra de arriba no dice nada');
  else if (R.motivo === 'sin mas muestras') malas.push(a.n + ': la pasada de retener se quedo sin muestras antes del tope — no se ha medido ningun limite, hace falta material mas largo');
  else if (R.llegoAlTope) console.log('      -> el fondo aguanta al menos 40 retenidos: la propuesta NO muere por aqui');
  else console.log('      -> el fondo se agota en ' + R.salidas + ' retenidos' + (R.salidas < 12 ? '  <<< POR DEBAJO del ciclo de 12 que la propuesta necesita' : ''));
}
console.log('');
for (const x of malas) console.log('   *** ' + x);
ws.close();
process.exitCode = malas.length ? 1 : 0;
