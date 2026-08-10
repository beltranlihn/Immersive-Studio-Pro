/* [R346b - verificacion adversarial, parte 3] EL PEOR CASO POSIBLE PARA LA CANDIDATA 1.

   La parte 2 disparo la #2 a desfases fijos y siempre salio el fotograma correcto, pero casi todas las veces
   porque el seek de la #1 YA HABIA TERMINADO (`seeking=no`, `rs=4`). Eso no prueba nada sobre el caso que la
   hipotesis describe. Aqui se construye a proposito:

     (0) Seeks CORTOS y ya bufereados (1, 2, 5 fotogramas), que es lo que hace un arrastre: se mira si
         `readyState` sigue >=2 mientras `seeking` es true. Si cae a 1, la tercera mitad de la guarda
         (`v.readyState>=2`) impide el atajo a mitad de seek y la candidata 1 muere ahi.

     (1) Solape SINCRONIZADO: la llamada #2 se lanza EN EL INSTANTE EXACTO en que `v.seeking===true`, que es
         la unica ventana en la que la hipotesis puede darse. Se prueba con salto largo y con salto de un
         fotograma, y se mira la CONCLUSION (pixeles del lienzo).

   La sonda SABE FALLAR: se mide primero la distancia entre fotogramas VECINOS; si fuera ~0 no se afirma nada.
   Y lleva el control del modo de fallo reconstruido a mano.

   Uso:  npx electron . --remote-debugging-port=9222   y luego  node scratchpad/r346b-verif-pedt-c.mjs
   (requiere haber corrido antes r346b-verif-pedt-b.mjs, que es quien monta el proyecto)
*/
import http from 'http';

const lista = await new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9222, path: '/json/list' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const pg = lista.find(x => x.type === 'page' && /index\.html/.test(x.url));
if (!pg) { console.log('*** la app no esta escuchando en 9222'); process.exit(2); }
const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const ev = x => new Promise(r => { const i = ++id; pend.set(i, m => r(m.result && m.result.exceptionDetails ? ('EXC ' + (m.result.exceptionDetails.exception?.description || '').slice(0, 600)) : (m.result && m.result.result && m.result.result.value))); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: x, awaitPromise: true, returnByValue: true, timeout: 600000 } })); });

const listo = await ev(`(function(){ return {clips:state.clips.length, inst:_vinst.size, wc:!!state.view.wcDecode, tieneUtil:typeof __bloque==='function'}; })()`);
console.log('');
console.log('R346b parte 3 - el peor caso para la candidata 1');
console.log('estado: clips=' + listo.clips + ' instancias=' + listo.inst + ' wcDecode=' + listo.wc);
if (!listo.clips || !listo.tieneUtil) { console.log('*** falta el montaje: corre antes  node scratchpad/r346b-verif-pedt-b.mjs'); ws.close(); process.exit(1); }

/* ---------- (0) readyState durante seeks CORTOS y bufereados ---------- */
const p0 = await ev(`(async()=>{ try{
  await __ir(3.0); await __dormir(300);
  const vi=[..._vinst.values()][0]; if(!vi||!vi.vel) return {err:'sin <video>'};
  const v=vi.vel; const F=1/24; const base=3.0;
  for(const t of [base-0.3,base,base+0.3,base+0.6]) await new Promise(res=>{ const on=()=>{v.removeEventListener('seeked',on);res();}; v.addEventListener('seeked',on); v.currentTime=t; });
  await __dormir(500);
  let buff=''; for(let i=0;i<v.buffered.length;i++) buff+='['+v.buffered.start(i).toFixed(2)+','+v.buffered.end(i).toFixed(2)+']';
  const filas=[];
  for(const df of [1,2,5,-1,-2]){
    await new Promise(res=>{ const on=()=>{v.removeEventListener('seeked',on);res();}; v.addEventListener('seeked',on); v.currentTime=base; });
    await __dormir(200);
    const t=base+df*F; const m=[]; let hecho=false; const t0=performance.now();
    const on=()=>{ v.removeEventListener('seeked',on); hecho=true; };
    v.addEventListener('seeked',on); v.currentTime=t;
    const mide=()=>({ct:v.currentTime, seeking:v.seeking, rs:v.readyState, guarda:(Math.abs(v.currentTime-t)<1e-3 && v.readyState>=2)});
    m.push(mide());
    while(!hecho && performance.now()-t0<3000){ await __dormir(0); if(m.length<400) m.push(mide()); }
    const vuelo=m.filter(x=>x.seeking===true);
    filas.push({salto:df, ms:+(performance.now()-t0).toFixed(1), enVuelo:vuelo.length,
                rs:[...new Set(vuelo.map(x=>x.rs))].join(','), guardaEnVuelo:vuelo.filter(x=>x.guarda).length,
                ctExacto:vuelo.filter(x=>x.ct===t).length});
  }
  return {buff:buff, filas:filas};
}catch(e){ return {err:String(e&&e.stack||e).slice(0,400)}; } })()`);
console.log('');
console.log('   (0) readyState MIENTRAS seeking===true, en seeks CORTOS y bufereados');
if (p0.err) console.log('       *** ' + p0.err);
else {
  console.log('       buffered: ' + p0.buff);
  for (const f of p0.filas) console.log('       salto ' + String(f.salto).padStart(2) + ' fotograma(s) · seeked en ' + String(f.ms).padStart(6)
    + ' ms · muestras con seeking=true: ' + String(f.enVuelo).padStart(4) + ' · readyState visto={' + f.rs + '} · ct===t en ' + f.ctExacto
    + ' · LA GUARDA ENTERA se cumple en vuelo: ' + f.guardaEnVuelo);
}

/* ---------- (1) solape SINCRONIZADO con la ventana de seeking ---------- */
const p1 = await ev(`(async()=>{ try{
  const F=1/24;
  const casos=[ {n:'salto largo  1,0 -> 6,0 s', t0:1.0, t1:6.0},
                {n:'un fotograma 6,0 -> +1F  ', t0:6.0, t1:6.0+F},
                {n:'dos fotogr.  6,0 -> +2F  ', t0:6.0, t1:6.0+2*F} ];
  const filas=[];
  for(const cs of casos){
    const refA=await __ir(cs.t0); await __dormir(300);
    const refB=await __ir(cs.t1); await __dormir(300);
    const senal=__mad(refA,refB);
    for(const modo of [false,true]){
      let capturado=0, viejo=0, det=[];
      for(let rep=0; rep<4; rep++){
        await __ir(cs.t0); await __dormir(300);
        _scrubFast=modo;
        const vi=[..._vinst.values()][0]; const v=vi&&vi.vel;
        state.playhead=cs.t1;
        const a=scrubRender();                       /* #1 */
        /* esperar ACTIVAMENTE a la ventana de seeking, sin ceder mas de lo justo */
        let obs=null; const t0=performance.now();
        while(performance.now()-t0<400){
          if(v && v.seeking){ obs={ct:+v.currentTime.toFixed(6), rs:v.readyState, seeking:true, pedT:(vi._pedT==null?null:+vi._pedT.toFixed(6))}; break; }
          await __dormir(0); }
        if(obs) capturado++;
        if(!obs && v) obs={ct:+v.currentTime.toFixed(6), rs:v.readyState, seeking:false, pedT:(vi._pedT==null?null:+vi._pedT.toFixed(6))};
        const b=scrubRender();                       /* #2, disparada DENTRO de la ventana */
        await Promise.all([a,b]);
        _scrubFast=false;
        const pix=__bloque();
        const mn=__mad(pix,refB), mv=__mad(pix,refA);
        if(mv<mn) viejo++;
        det.push({obs:obs, mn:mn, mv:mv});
      }
      filas.push({caso:cs.n, modo:modo?'arrastre':'salto', senal:senal, reps:4, capturado:capturado, viejo:viejo, det:det});
    }
  }
  return {filas:filas};
}catch(e){ return {err:String(e&&e.stack||e).slice(0,500)}; } })()`);
console.log('');
console.log('   (1) LA #2 DISPARADA DENTRO DE LA VENTANA seeking===true (el peor caso)');
if (p1.err) console.log('       *** ' + p1.err);
else for (const f of p1.filas) {
  console.log('');
  console.log('       ' + f.caso + '  [' + f.modo + ']   senal entre los dos fotogramas: MAD=' + f.senal
    + (f.senal < 0.5 ? '   *** SENAL DEMASIADO DEBIL: no se afirma nada ***' : ''));
  console.log('         ventana de seeking capturada en ' + f.capturado + '/' + f.reps + ' repeticiones · fotograma VIEJO en ' + f.viejo + '/' + f.reps);
  for (const d of f.det) {
    const o = d.obs;
    const atajo = o ? (o.rs >= 2) : null;
    console.log('           al disparar la #2: seeking=' + (o ? (o.seeking ? 'SI' : 'no') : '?') + ' rs=' + (o ? o.rs : '?')
      + ' ct=' + (o ? o.ct : '?') + ' _pedT=' + (o ? o.pedT : '?') + ' -> readyState deja el atajo: ' + (atajo === null ? '?' : (atajo ? 'SI' : 'NO'))
      + ' | pixeles vs nuevo=' + String(d.mn).padStart(7) + ' vs viejo=' + String(d.mv).padStart(7) + '  ' + (d.mv < d.mn ? '*** VIEJO ***' : 'correcto'));
  }
}
console.log('');
console.log('errs JS: ' + JSON.stringify(await ev(`window.__errs?window.__errs.slice(0,3):[]`)));
ws.close();
