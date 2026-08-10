/* [R346b - verificacion adversarial] SEMANTICA CRUDA DE <video>, que es de lo que cuelgan las dos hipotesis
   sobre el atajo de `vinstSeekVideo` (app.js ~8578).

   (a) CANDIDATA 1: "durante un seek en vuelo, `currentTime` devuelve el DESTINO pendiente" -> las dos mitades
       de la guarda nueva (`|ct-t|<1e-3` y `_pedT===t`) se cumplirian a mitad de seek y el atajo subiria el
       fotograma ANTERIOR. Se mide `currentTime`, `seeking` y `readyState` justo tras asignar y mientras
       `seeking` sigue true. El `readyState>=2` es la tercera mitad de la guarda: si se cae a 1 durante el
       seek, el atajo NO se dispara y la hipotesis muere ahi.

   (b) CANDIDATA 2: "asignar a `currentTime` un valor EXACTAMENTE igual al que ya tiene no dispara `seeked`"
       -> la promesa de `vinstSeekVideo` no resolveria nunca y `seekExport` se colgaria sin plazo.
       Se mide: 1) si tras un seek en pausa `currentTime` devuelve el destino BIT A BIT, que es la premisa;
       2) si reasignar ese mismo float dispara `seeked`; 3) idem con el elemento reproduciendo.

   La sonda SABE FALLAR: (b) incluye un control con un destino DISTINTO, que tiene que disparar `seeked`; si
   el control tampoco dispara, es que el arnes esta roto y no se afirma nada.

   Uso:  npx electron . --remote-debugging-port=9222   y luego  node scratchpad/r346b-verif-pedt-a.mjs
*/
import http from 'http';
import { existsSync } from 'fs';

const S = 'C:/Users/beltr/Desktop/Alma Digital Studio/Projects/Immersive Studio Pro/scratchpad/media/';
const RUTA = S + 'tunel-control.mp4';
if (!existsSync(RUTA)) { console.log('   NO MEDIDA: falta ' + RUTA); process.exit(3); }

const lista = await new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9222, path: '/json/list' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const pg = lista.find(x => x.type === 'page' && /index\.html/.test(x.url));
if (!pg) { console.log('*** la app no esta escuchando en 9222'); process.exit(2); }
const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const ev = x => new Promise(r => { const i = ++id; pend.set(i, m => r(m.result && m.result.exceptionDetails ? ('EXC ' + (m.result.exceptionDetails.exception?.description || '').slice(0, 500)) : (m.result && m.result.result && m.result.result.value))); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: x, awaitPromise: true, returnByValue: true, timeout: 300000 } })); });

const PAGINA = `(async()=>{ let v=null; try{
  const RUTA=${JSON.stringify(RUTA)};
  v=document.createElement('video'); v.src=DSP.toFileURL(RUTA); v.muted=true; v.playsInline=true; v.preload='auto';
  await new Promise((res,rej)=>{ v.onloadeddata=()=>res(); v.onerror=()=>rej(new Error('el <video> no carga')); });
  const dur=v.duration;
  const seek=(t)=>new Promise(res=>{ const on=()=>{ v.removeEventListener('seeked',on); res(); }; v.addEventListener('seeked',on); v.currentTime=t; });
  const dormir=ms=>new Promise(r=>setTimeout(r,ms));

  /* ---------- (a) que dicen currentTime / seeking / readyState DURANTE un seek en vuelo ---------- */
  const A=[];
  const correA=async(desde,hasta)=>{
    await seek(desde); await dormir(120);
    const fila={desde:desde,hasta:hasta,muestras:[],dtSeeked:0};
    let hecho=false; const t0=performance.now();
    const on=()=>{ v.removeEventListener('seeked',on); hecho=true; fila.dtSeeked=+(performance.now()-t0).toFixed(1); };
    v.addEventListener('seeked',on);
    v.currentTime=hasta;
    const mide=(etq)=>({ q:etq, ct:v.currentTime, dist:+Math.abs(v.currentTime-hasta).toExponential(2),
                         exacto:(v.currentTime===hasta), seeking:v.seeking, rs:v.readyState,
                         atajoViejo:(Math.abs(v.currentTime-hasta)<1e-3 && v.readyState>=2) });
    fila.muestras.push(mide('sincrono'));
    while(!hecho && performance.now()-t0<4000){ await dormir(1);
      if(fila.muestras.length<40) fila.muestras.push(mide('+'+Math.round(performance.now()-t0)+'ms')); }
    fila.muestras.push(mide('tras seeked'));
    /* resumen: en cuantas muestras EN VUELO (seeking===true) se habria disparado el atajo */
    const vuelo=fila.muestras.filter(x=>x.seeking===true);
    fila.enVuelo=vuelo.length;
    fila.enVueloConAtajo=vuelo.filter(x=>x.atajoViejo).length;
    fila.enVueloCtExacto=vuelo.filter(x=>x.exacto).length;
    fila.rsEnVuelo=[...new Set(vuelo.map(x=>x.rs))].join(',');
    return fila; };
  A.push(await correA(0.5, dur*0.72));
  A.push(await correA(dur*0.72, 0.25));
  A.push(await correA(0.25, dur*0.9));

  /* ---------- (b) reasignar el MISMO float: dispara seeked? ---------- */
  const B=[];
  const correB=async(destino,etq,reproduciendo)=>{
    await seek(destino); await dormir(200);
    if(reproduciendo){ try{ await v.play(); }catch(e){} await dormir(150); try{ v.pause(); }catch(e){} await dormir(80); }
    const X=v.currentTime;                       /* lo que el elemento dice tener AHORA */
    let disparo=false, dt=0; const t0=performance.now();
    const on=()=>{ disparo=true; dt=+(performance.now()-t0).toFixed(1); };
    v.addEventListener('seeked',on);
    const antes=v.seeking;
    v.currentTime=X;                             /* el MISMO float, bit a bit */
    const trasAsignar={seeking:v.seeking, ct:v.currentTime};
    await dormir(2500);
    v.removeEventListener('seeked',on);
    return { etq:etq, pedido:destino, X:X, ctIgualPedido:(X===destino), delta:+(X-destino).toExponential(3),
             seekingAntes:antes, seekingTrasAsignar:trasAsignar.seeking, disparoSeeked:disparo, ms:dt }; };

  B.push(await correB(1.5,'pausado, mismo float',false));
  B.push(await correB(dur*0.6,'pausado, mismo float (otro punto)',false));
  B.push(await correB(2.25,'tras reproducir y pausar',true));

  /* CONTROL de la sonda: un destino DISTINTO tiene que disparar seeked. Si no, el arnes esta roto. */
  const correControl=async(destino,salto)=>{
    await seek(destino); await dormir(200);
    const X=v.currentTime;
    let disparo=false, dt=0; const t0=performance.now();
    const on=()=>{ disparo=true; dt=+(performance.now()-t0).toFixed(1); };
    v.addEventListener('seeked',on);
    v.currentTime=X+salto;
    await dormir(2500);
    v.removeEventListener('seeked',on);
    return { etq:'CONTROL salto '+salto+'s', disparoSeeked:disparo, ms:dt }; };
  B.push(await correControl(1.5, 0.5));
  B.push(await correControl(1.5, 2e-6));      /* la TOLERANCIA de instanteDecod: un salto sub-microsegundo */
  B.push(await correControl(1.5, 1e-9));      /* mas pequeno que un tick de tiempo de medio */

  return JSON.stringify({ chrome:navigator.userAgent.match(/Chrome\\/[\\d.]+/)[0], dur:+dur.toFixed(3), A:A, B:B });
}catch(e){ return 'ERR '+String((e&&e.message)||e).slice(0,400);
} finally { try{ if(v){ v.pause(); v.removeAttribute('src'); v.load(); } }catch(e){} } })()`;

const r = await ev(PAGINA);
let o = null; try { o = JSON.parse(r); } catch (e) { console.log('*** ' + String(r).slice(0, 600)); ws.close(); process.exit(1); }

console.log('');
console.log('R346b - semantica cruda de <video>   (' + o.chrome + ' · tunel-control.mp4, ' + o.dur + ' s)');
console.log('');
console.log('   (a) QUE DICE currentTime DURANTE UN SEEK EN VUELO   <- de esto cuelga la CANDIDATA 1');
for (const f of o.A) {
  console.log('');
  console.log('      seek ' + f.desde.toFixed(3) + ' -> ' + f.hasta.toFixed(3) + '   (seeked a los ' + f.dtSeeked + ' ms)');
  for (const m of f.muestras.slice(0, 12)) {
    console.log('         ' + String(m.q).padEnd(12) + ' ct=' + m.ct.toFixed(6) + '  dist=' + String(m.dist).padStart(9)
      + '  exacto=' + (m.exacto ? 'SI' : 'no') + '  seeking=' + (m.seeking ? 'SI' : 'no') + '  rs=' + m.rs
      + '   atajo?=' + (m.atajoViejo ? '*** SI ***' : 'no'));
  }
  if (f.muestras.length > 12) console.log('         ... ' + (f.muestras.length - 12) + ' muestras mas');
  console.log('         EN VUELO: ' + f.enVuelo + ' muestras · ct exacto en ' + f.enVueloCtExacto
    + ' · la guarda de distancia+readyState se cumple en ' + f.enVueloConAtajo + ' · readyState visto: {' + f.rsEnVuelo + '}');
}
console.log('');
console.log('   (b) REASIGNAR EL MISMO FLOAT: dispara seeked?   <- de esto cuelga la CANDIDATA 2');
for (const b of o.B) {
  if (b.pedido === undefined) { console.log('      ' + b.etq.padEnd(34) + '  seeked=' + (b.disparoSeeked ? 'SI (' + b.ms + ' ms)' : '*** NO ***')); continue; }
  console.log('      ' + b.etq.padEnd(34) + '  pedido=' + b.pedido.toFixed(6) + '  ct devuelto=' + b.X.toFixed(9)
    + '  identico=' + (b.ctIgualPedido ? 'SI' : 'no (' + b.delta + ')')
    + '  seeking tras asignar=' + (b.seekingTrasAsignar ? 'SI' : 'no')
    + '  seeked=' + (b.disparoSeeked ? 'SI (' + b.ms + ' ms)' : '*** NO ***'));
}
console.log('');
ws.close();
