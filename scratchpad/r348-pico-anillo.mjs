/* [R348b] Cuantos fotogramas retiene DE VERDAD el anillo de export, medidos en vez de deducidos.

   La revision encontro una incoherencia en lo que R348 escribio en COMPONENTS.md: la fila afirmaba que el
   anillo de export "vive en 2 detras + 6 delante ~ 8 en cache, o sea pegado al limite del fondo", y eso no
   cuadra con que la app funcione. Si el fondo se agota en 6 retenidos para material como `o1.mp4` -medido en
   `r348-fondo-salida.mjs`, ahora con la configuracion exacta de la app- y el anillo retuviera 8, todo export de
   ese material agotaria el fondo, `seekCDExport` gastaria sus 10 s y caeria al repliegue `<video>`. No pasa.

   El "~8" no era una medida: era aritmetica sobre AHEAD=6 y BEHIND=2. Esto mide el PICO real de `cache.size`
   mientras se recorre un tramo como lo recorre el export, usando `cd.stats()`, que es lo que el ClipDecoder
   expone.

   RESULTADO, y desmonta la comparacion entera: el anillo llega a un pico de 15 retenidos con `o1.mp4`, o sea
   MAS que los 6 en los que se estancaba la pasada de retencion, y el export funciona igual. Asi que ese 6 no es
   un techo de "cuantos fotogramas puede tener abiertos la app": lo que mide la pasada de retencion es otro
   REGIMEN —alimentar sin parar sin soltar NUNCA un fotograma—, y en ese regimen el decodificador deja de emitir.
   El anillo, en cambio, recicla: al avanzar el objetivo, `evict` cierra los de detras y los buferes vuelven al
   fondo. Los dos numeros no se pueden poner uno al lado del otro, que es exactamente lo que R348 hizo en
   COMPONENTS.md.
   Lo que la pasada de retencion SI establece -y es lo unico que hace falta para cerrar la optimizacion
   aparcada- es que retener un ciclo entero MIENTRAS SE SIGUE ALIMENTANDO estanca al decodificador. Que es
   literalmente lo que haria ensanchar BEHIND, y literalmente lo que R257 midio como la rendicion de 980
   ms/fotograma.

   AVISO, igual que su hermana `r348-fondo-salida.mjs`: levanta ClipDecoders sobre material pesado, asi que se
   pasa en una instancia recien levantada y se reinicia despues. Con la instancia cargada de sondas anteriores,
   `npm run redes` dio dos rojos que se fueron al reiniciar. Ninguna de las dos esta en `correr-redes.mjs`.

   Uso:  npx electron . --remote-debugging-port=9222   y luego  node scratchpad/r348-pico-anillo.mjs
*/
import http from 'http';
import { existsSync } from 'fs';

const S = 'C:/Users/beltr/Desktop/Alma Digital Studio/Projects/Immersive Studio Pro/scratchpad/media/';
const RITO = 'C:/Users/beltr/Desktop/Rito Movie/Asset/Creation/';
const ARCHIVOS = [
  { n: 'tunel-control.mp4  (960x960)', p: S + 'tunel-control.mp4', fondo: 9 },
  { n: 'gop240-60fps.mp4   (2560x1440)', p: S + 'gop240-60fps.mp4', fondo: 16 },
  { n: 'o1.mp4             (2560x1440, material real)', p: RITO + 'o1.mp4', fondo: 6 },
].filter(a => existsSync(a.p));
if (!ARCHIVOS.length) { console.log('   NO MEDIDA: no hay material'); process.exit(3); }

const lista = await new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9222, path: '/json/list' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const pg = lista.find(x => x.type === 'page' && /index\.html/.test(x.url));
if (!pg) { console.log('*** la app no esta escuchando en 9222'); process.exit(2); }
const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const ev = x => new Promise(r => { const i = ++id; pend.set(i, m => r(m.result && m.result.exceptionDetails ? ('EXC ' + (m.result.exceptionDetails.exception?.description || '').slice(0, 400)) : (m.result && m.result.result && m.result.result.value))); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: x, awaitPromise: true, returnByValue: true, timeout: 150000 } })); });

const PAGINA = (ruta) => `(async()=>{ let cd=null; try{
  const RUTA=${JSON.stringify(ruta)}, NUM=60;
  const d=await demuxMP4(RUTA); const fps=d.fps||30;
  cd=makeClipDecoder(d,true);   /* ex=true: el anillo del EXPORT, que es el del que habla la fila */
  const I0=Math.floor(d.samples.length*0.3);
  let pico=0, picoTrasPump=0, resets=0;
  for(let i=I0;i<I0+NUM;i++){
    const tus=instanteDecod(i/fps)*1e6;
    cd.setTarget(tus);
    const t0=performance.now();
    while(!cd.passed(tus)){ cd.pump();
      const s=cd.stats(); if(s.cache>picoTrasPump)picoTrasPump=s.cache;
      if(cd.isDead()) throw new Error('el decodificador murio');
      if(performance.now()-t0>10000) throw new Error('no llega a '+tus+' en 10 s (stats '+JSON.stringify(cd.stats())+')');
      await new Promise(r=>setTimeout(r,2)); }
    const f=cd.frameNear(tus); if(!f) throw new Error('sin fotograma en '+i);
    const s=cd.stats(); if(s.cache>pico)pico=s.cache; resets=s.resets;
  }
  return JSON.stringify({pico:pico, picoTrasPump:picoTrasPump, resets:resets, fps:+fps.toFixed(3), I0:I0});
}catch(e){ return 'ERR '+String((e&&e.message)||e).slice(0,300);
} finally { try{cd&&cd.close();}catch(e){} } })()`;

console.log('');
console.log('R348b - fotogramas que el anillo de EXPORT retiene de verdad (pico de cache.size)');
console.log('        al lado del fondo de salida medido en r348-fondo-salida.mjs');
const malas = [];
for (const a of ARCHIVOS) {
  const r = await ev(PAGINA(a.p));
  let o = null; try { o = JSON.parse(r); } catch (e) { console.log(''); console.log('   ' + a.n); console.log('   *** ' + String(r).slice(0, 400)); malas.push(a.n + ': no se pudo medir'); continue; }
  console.log('');
  console.log('   ' + a.n + '   ' + o.fps + ' fps · 60 instantes desde el ' + o.I0 + ' · ' + o.resets + ' reinicios');
  console.log('      pico de cache.size: ' + o.pico + ' al entregar · ' + o.picoTrasPump + ' durante el bombeo');
  console.log('      pasada de retencion de r348-fondo-salida: se estanco en ' + a.fondo);
  console.log('      -> ' + (o.pico > a.fondo
    ? 'el anillo RETIENE MAS (' + o.pico + ') que lo que aguantaba la pasada de retencion (' + a.fondo + ') y el export funciona igual: los dos numeros NO son comparables'
    : 'el anillo se queda en ' + o.pico + ', por debajo de ' + a.fondo));
}
console.log('');
for (const x of malas) console.log('   *** ' + x);
ws.close();
process.exitCode = malas.length ? 1 : 0;
