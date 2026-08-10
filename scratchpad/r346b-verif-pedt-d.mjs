/* [R346b - verificacion adversarial, parte 4] EL SOLAPE CON INSTANTES DISTINTOS.

   La candidata 1 hablaba de dos `scrubRender` para el MISMO instante, y las partes 2 y 3 la dejan sin trigger
   (`readyState` cae a 1 en vuelo y el atajo no se dispara). Pero un arrastre real encadena instantes
   DISTINTOS, y ahi hay un segundo mecanismo posible en las mismas dos lineas, que nada tiene que ver con
   `_pedT`: los oyentes de `seeked` se apilan sobre el MISMO <video>.

     #1 registra su `on` y pide t1.  #2 registra el suyo y pide t2 antes de que t1 llegue.
     Cuando Chromium dispara UN solo `seeked`, lo reciben LOS DOS -> la #2 puede resolver con el fotograma de
     t1, y como es la ultima (`tok===seekTok`) es la unica que pinta.

   Se mide la CONCLUSION (pixeles) con la #2 disparada dentro de la ventana de seeking de la #1.
   Control del modo de fallo incluido: se exige que la sonda distinga t1 de t2 (MAD) antes de afirmar nada.

   Uso: requiere el montaje de r346b-verif-pedt-b.mjs ya hecho en la app.
*/
import http from 'http';

const lista = await new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9222, path: '/json/list' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const pg = lista.find(x => x.type === 'page' && /index\.html/.test(x.url));
if (!pg) { console.log('*** la app no esta escuchando en 9222'); process.exit(2); }
const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const ev = x => new Promise(r => { const i = ++id; pend.set(i, m => r(m.result && m.result.exceptionDetails ? ('EXC ' + (m.result.exceptionDetails.exception?.description || '').slice(0, 600)) : (m.result && m.result.result && m.result.result.value))); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: x, awaitPromise: true, returnByValue: true, timeout: 600000 } })); });

const listo = await ev(`(function(){ return {clips:state.clips.length, util:typeof __bloque==='function'}; })()`);
if (!listo.clips || !listo.util) { console.log('*** falta el montaje: corre antes  node scratchpad/r346b-verif-pedt-b.mjs'); ws.close(); process.exit(1); }

console.log('');
console.log('R346b parte 4 - solape de scrubRender con instantes DISTINTOS');

const p = await ev(`(async()=>{ try{
  const F=1/24, T0=5.0;
  const casos=[ {n:'t1=+2F  t2=+4F ', d1:2*F, d2:4*F}, {n:'t1=+1F  t2=+2F ', d1:1*F, d2:2*F}, {n:'t1=+1,0s t2=+2,0s', d1:1.0, d2:2.0} ];
  const filas=[];
  for(const cs of casos){
    const t1=T0+cs.d1, t2=T0+cs.d2;
    const r0=await __ir(T0); await __dormir(300);
    const r1=await __ir(t1); await __dormir(300);
    const r2=await __ir(t2); await __dormir(300);
    const s12=__mad(r1,r2), s02=__mad(r0,r2);
    let malo=0, capt=0; const det=[];
    for(let rep=0;rep<5;rep++){
      await __ir(T0); await __dormir(300);
      const vi=[..._vinst.values()][0]; const v=vi&&vi.vel;
      state.playhead=t1; const a=scrubRender();                 /* #1 pide t1 */
      let obs=null; const q0=performance.now();
      while(performance.now()-q0<400){ if(v&&v.seeking){ obs={rs:v.readyState,ct:+v.currentTime.toFixed(6),pedT:(vi._pedT==null?null:+vi._pedT.toFixed(6))}; break; } await __dormir(0); }
      if(obs) capt++;
      state.playhead=t2; const b=scrubRender();                 /* #2 pide t2, en plena ventana de seeking */
      await Promise.all([a,b]);
      const pix=__bloque();
      const m2=__mad(pix,r2), m1=__mad(pix,r1), m0=__mad(pix,r0);
      const cual = (m2<=m1 && m2<=m0) ? 't2 (correcto)' : (m1<m0 ? '*** t1 (el de la #1) ***' : '*** T0 (el viejo) ***');
      if(m2>Math.min(m1,m0)) malo++;
      det.push({obs:obs,m0:m0,m1:m1,m2:m2,cual:cual});
    }
    filas.push({caso:cs.n, s12:s12, s02:s02, capt:capt, malo:malo, det:det});
  }
  await __ir(5.0);
  return {filas:filas};
}catch(e){ return {err:String(e&&e.stack||e).slice(0,500)}; } })()`);

if (p.err) console.log('*** ' + p.err);
else for (const f of p.filas) {
  console.log('');
  console.log('   ' + f.caso + '   senal t1 vs t2: MAD=' + f.s12 + ' · T0 vs t2: MAD=' + f.s02
    + (f.s12 < 0.5 ? '   *** SENAL DEMASIADO DEBIL: no se afirma nada ***' : ''));
  console.log('     ventana de seeking capturada en ' + f.capt + '/5 · fotograma EQUIVOCADO en ' + f.malo + '/5');
  for (const d of f.det) console.log('       rs al lanzar la #2=' + (d.obs ? d.obs.rs : '?') + ' _pedT=' + (d.obs ? d.obs.pedT : '?')
    + ' | MAD vs T0=' + String(d.m0).padStart(7) + ' vs t1=' + String(d.m1).padStart(7) + ' vs t2=' + String(d.m2).padStart(7) + '  -> pinto ' + d.cual);
}
console.log('');
console.log('errs JS: ' + JSON.stringify(await ev(`window.__errs?window.__errs.slice(0,3):[]`)));
ws.close();
