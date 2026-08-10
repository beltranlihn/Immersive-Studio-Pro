/* [R346b - verificacion adversarial, parte 2] LA CONCLUSION, sobre el CODIGO REAL de la app.

   (0) El seek CORTO y ya bufereado: `r346b-verif-pedt-a.mjs` midio que `readyState` cae a 1 mientras un seek
       LARGO esta en vuelo, lo que mataria a la candidata 1. Pero el caso que la candidata describe es el de un
       arrastre: saltos de un fotograma sobre material ya bufereado. Si ahi `readyState` se quedara en 4, la
       guarda entera se cumpliria a mitad de seek. Se mide con saltos de 1, 2 y 5 fotogramas hacia adelante y
       hacia atras, con el buffer caliente.

   (1) CANDIDATA 1 - `scrubRender` solapado: dos llamadas para el MISMO instante. La #1 lanza el seek de
       verdad; la #2 llega a los pocos ms y -segun la hipotesis- coge el atajo, sube la textura VIEJA y como es
       la ultima (`tok===seekTok`) es la unica que pinta -> el lienzo se queda con el fotograma anterior.
       Se mide la CONCLUSION: los PIXELES del lienzo, comparados contra la referencia del instante pedido y
       contra el fotograma anterior. Se prueban varios desfases entre las dos llamadas y los dos modos
       (`_scrubFast` apagado = salto; encendido = arrastre).

   (2) CANDIDATA 2 - la promesa que no resuelve: se aparca el <video> EXACTAMENTE donde lo deja `play()`
       (`currentTime=instanteDecod(local)`), se borra `_pedT` (que `play()` no escribe) y se pide ese mismo
       instante por `vinstSeek`. Si la hipotesis es cierta, la promesa no resuelve nunca.

   La sonda SABE FALLAR: (1) lleva un control que reconstruye el modo de fallo (una sola llamada, sin repintar
   despues) y exige que los pixeles salgan viejos; (2) lleva un control que pide un instante DISTINTO y exige
   que resuelva. Si los controles no se comportan, no se afirma nada.

   Uso:  npx electron . --remote-debugging-port=9222   y luego  node scratchpad/r346b-verif-pedt-b.mjs
*/
import http from 'http';
import { existsSync } from 'fs';

const RUTA = 'C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro\\scratchpad\\media\\tunel-control.mp4';
if (!existsSync(RUTA)) { console.log('   NO MEDIDA: falta ' + RUTA); process.exit(3); }

const lista = await new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9222, path: '/json/list' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const pg = lista.find(x => x.type === 'page' && /index\.html/.test(x.url));
if (!pg) { console.log('*** la app no esta escuchando en 9222'); process.exit(2); }
const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const ev = x => new Promise(r => { const i = ++id; pend.set(i, m => r(m.result && m.result.exceptionDetails ? ('EXC ' + (m.result.exceptionDetails.exception?.description || '').slice(0, 600)) : (m.result && m.result.result && m.result.result.value))); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: x, awaitPromise: true, returnByValue: true, timeout: 600000 } })); });
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ---------- montaje: proyecto flat + un solo clip del material de control ---------- */
console.log('');
console.log('R346b - verificacion adversarial, parte 2 (codigo real de la app)');
console.log('GPU: ' + await ev(`(function(){const d=gl.getExtension('WEBGL_debug_renderer_info'); return d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):'?';})()`));
await ev(`(async()=>{try{await startDemoProject('flat');}catch(e){}})()`); await wait(2600);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){} return 1;})()`);
const mont = await ev(`(async function(){
  let m=state.media.find(x=>x.name==='tunel-control.mp4');
  if(!m) m=await addVideoFromPath(${JSON.stringify(RUTA)},'tunel-control.mp4');
  if(!m) return {err:'no se pudo importar'};
  state.clips=[]; const li=state.lanes.findIndex(l=>l.kind==='video');
  addClip(m,li,0); const c=state.clips[state.clips.length-1]; c.dur=m.dur; c.speed=1;
  state.useProxies=false; state.view.useProxy=false;
  renderTimeline();
  return {media:m.name, dur:+m.dur.toFixed(3), w:m.w, h:m.h, fps:m.fps, clips:state.clips.length, wcDecode:!!state.view.wcDecode};
})()`);
if (mont.err) { console.log('*** ' + mont.err); ws.close(); process.exit(1); }
await wait(1200);
console.log('material: ' + mont.media + ' · ' + mont.dur + ' s · ' + mont.w + 'x' + mont.h + ' · wcDecode=' + mont.wcDecode + ' (si es true, el camino de <video> ni se toca)');

/* ---------- utilidades de pagina ---------- */
await ev(`
window.__dormir=ms=>new Promise(r=>setTimeout(r,ms));
window.__bloque=function(){ const W=glc.width,H=glc.height; const bw=Math.min(320,W), bh=Math.min(320,H);
  const b=new Uint8Array(bw*bh*4); gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  gl.readPixels((W-bw)>>1,(H-bh)>>1,bw,bh,gl.RGBA,gl.UNSIGNED_BYTE,b); return b; };
window.__mad=function(a,b){ let s=0,n=0; for(let i=0;i<a.length;i+=4){ s+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]); n+=3; } return +(s/n).toFixed(3); };
window.__ir=async function(t){ state.playhead=t; await scrubRender(); render(); gl.finish(); return __bloque(); };
1`);

/* ---------- (0) readyState durante un seek CORTO y bufereado ---------- */
const p0 = await ev(`(async()=>{ try{
  const vi=[..._vinst.values()][0]; if(!vi||!vi.vel) return {err:'no hay instancia <video> (ha ido por WebCodecs?)'};
  const v=vi.vel; const fps=24, F=1/fps;
  await __dormir(200);
  const base=3.0;
  /* calentar el buffer alrededor */
  for(const t of [base-0.3,base,base+0.3]) await new Promise(res=>{ const on=()=>{v.removeEventListener('seeked',on);res();}; v.addEventListener('seeked',on); v.currentTime=t; });
  await __dormir(400);
  const buff=(()=>{ let s=''; for(let i=0;i<v.buffered.length;i++) s+='['+v.buffered.start(i).toFixed(2)+','+v.buffered.end(i).toFixed(2)+']'; return s; })();
  const filas=[];
  for(const df of [1,2,5,-1,-2]){
    await new Promise(res=>{ const on=()=>{v.removeEventListener('seeked',on);res();}; v.addEventListener('seeked',on); v.currentTime=base; });
    await __dormir(150);
    const t=base+df*F; const m=[]; let hecho=false; const t0=performance.now();
    const on=()=>{ v.removeEventListener('seeked',on); hecho=true; };
    v.addEventListener('seeked',on); v.currentTime=t;
    const mide=q=>({q:q, ct:v.currentTime, seeking:v.seeking, rs:v.readyState, guarda:(Math.abs(v.currentTime-t)<1e-3 && v.readyState>=2)});
    m.push(mide('sincrono'));
    while(!hecho && performance.now()-t0<3000){ await __dormir(1); if(m.length<25) m.push(mide('+'+Math.round(performance.now()-t0))); }
    const vuelo=m.filter(x=>x.seeking===true);
    filas.push({ salto:df+' fotograma(s)', ms:+(performance.now()-t0).toFixed(1), enVuelo:vuelo.length,
                 guardaEnVuelo:vuelo.filter(x=>x.guarda).length, rs:[...new Set(vuelo.map(x=>x.rs))].join(','),
                 ctExacto:vuelo.filter(x=>x.ct===t).length });
  }
  return {buff:buff, filas:filas};
}catch(e){ return {err:String(e&&e.message||e)}; } })()`);
console.log('');
console.log('   (0) readyState DURANTE un seek CORTO ya bufereado   <- el caso que describe la candidata 1');
if (p0.err) console.log('       *** ' + p0.err);
else {
  console.log('       buffered: ' + p0.buff);
  for (const f of p0.filas) console.log('       salto ' + String(f.salto).padEnd(16) + ' seeked en ' + String(f.ms).padStart(6) + ' ms · muestras en vuelo=' + String(f.enVuelo).padStart(3)
    + ' · readyState visto={' + f.rs + '} · ct===t en ' + f.ctExacto + ' · LA GUARDA ENTERA se cumple en vuelo: ' + f.guardaEnVuelo);
}

/* ---------- (1) scrubRender solapado ---------- */
const p1 = await ev(`(async()=>{ try{
  const T0=1.0, T1=6.0;                        /* muy separados: el fotograma viejo y el nuevo no se parecen */
  const refA=await __ir(T0); await __dormir(250);
  const refB=await __ir(T1); await __dormir(250);
  const dif=__mad(refA,refB);
  const filas=[];
  for(const modo of [false,true]){
    for(const desfase of [0,1,2,4,8,16]){
      await __ir(T0); await __dormir(250);
      _scrubFast=modo;
      const vi=[..._vinst.values()][0]; const v=vi&&vi.vel;
      state.playhead=T1;
      const a=scrubRender();                    /* llamada #1: lanza el seek de verdad */
      let obs=null;
      if(desfase>0) await __dormir(desfase);
      if(v) obs={ct:+v.currentTime.toFixed(6), rs:v.readyState, seeking:v.seeking, pedT:(vi._pedT==null?null:+vi._pedT.toFixed(6))};
      const b=scrubRender();                    /* llamada #2: el mismo instante */
      await Promise.all([a,b]);
      _scrubFast=false;
      const pix=__bloque();                     /* SIN volver a pintar: lo que quedo en el lienzo */
      /* la guarda del atajo, evaluada con lo observado justo antes de la #2 */
      const atajo = obs ? (Math.abs(obs.ct-(vi._pedT!=null?vi._pedT:NaN))<1e-3 && obs.rs>=2) : null;
      filas.push({modo:modo?'arrastre':'salto', desfase:desfase, obs:obs, atajoCalc:atajo,
                  madVsNuevo:__mad(pix,refB), madVsViejo:__mad(pix,refA)});
    }
  }
  /* CONTROL: reconstruir el modo de fallo a mano -> subir la textura vieja y pintar. Tiene que salir VIEJO. */
  await __ir(T0); await __dormir(250);
  const vi=[..._vinst.values()][0];
  state.playhead=T1; render(); gl.finish();     /* pinta con la textura todavia en T0 */
  const ctrl=__bloque();
  await __ir(T1); await __dormir(200);
  return {difRef:dif, filas:filas, control:{madVsNuevo:__mad(ctrl,refB), madVsViejo:__mad(ctrl,refA)}};
}catch(e){ return {err:String(e&&e.stack||e).slice(0,500)}; } })()`);
console.log('');
console.log('   (1) DOS scrubRender SOLAPADOS PARA EL MISMO INSTANTE   <- la candidata 1');
if (p1.err) console.log('       *** ' + p1.err);
else {
  console.log('       distancia entre el fotograma de 1,0 s y el de 6,0 s: MAD=' + p1.difRef + '  (es la senal; si fuera ~0 la sonda no distinguiria nada)');
  console.log('       CONTROL (modo de fallo reconstruido a mano): MAD vs nuevo=' + p1.control.madVsNuevo + '  vs viejo=' + p1.control.madVsViejo
    + '   -> ' + (p1.control.madVsViejo < p1.control.madVsNuevo ? 'la sonda SI sabe ver un fotograma viejo' : '*** LA SONDA NO SABE FALLAR: no se afirma nada ***'));
  console.log('');
  for (const f of p1.filas) {
    const o = f.obs;
    console.log('       ' + f.modo.padEnd(9) + ' desfase ' + String(f.desfase).padStart(2) + ' ms | antes de la #2: rs=' + (o ? o.rs : '?')
      + ' seeking=' + (o ? (o.seeking ? 'SI' : 'no') : '?') + ' ct=' + (o ? o.ct : '?') + ' _pedT=' + (o ? o.pedT : '?')
      + ' -> atajo=' + (f.atajoCalc === null ? '?' : (f.atajoCalc ? 'SI' : 'no'))
      + ' | pixeles: vs nuevo=' + String(f.madVsNuevo).padStart(7) + ' vs viejo=' + String(f.madVsViejo).padStart(7)
      + '  ' + (f.madVsViejo < f.madVsNuevo ? '*** VIEJO ***' : 'correcto'));
  }
}

/* ---------- (2) la promesa que no resuelve ---------- */
const p2 = await ev(`(async()=>{ try{
  const T=4.0; state.playhead=T;
  const drawn=collectDrawnVideoClips(state.clips,state.lanes,T,0,[]);
  if(!drawn.length) return {err:'no hay clip dibujado en T'};
  const {c,m,local}=drawn[0];
  const vi=vinstEnsure(c,m); await (vi.loadP||Promise.resolve());
  if(!vi.vel) return {err:'la instancia no tiene <video>'};
  const v=vi.vel;
  const prueba=async(etq,localPedido,aparcarEn,borrarPedT)=>{
    await new Promise(res=>{ const on=()=>{v.removeEventListener('seeked',on);res();}; v.addEventListener('seeked',on); v.currentTime=aparcarEn; });
    await __dormir(250);
    if(borrarPedT) vi._pedT=undefined;
    const ctAntes=v.currentTime, tQuePedira=instanteDecod(localPedido);
    const identico=(ctAntes===tQuePedira);
    const t0=performance.now();
    const r=await Promise.race([ vinstSeek(c,m,localPedido).then(()=>'RESUELVE'), __dormir(6000).then(()=>'CUELGA') ]);
    return {etq:etq, ctAntes:+ctAntes.toFixed(9), tPedido:+tQuePedira.toFixed(9), identico:identico,
            delta:+(ctAntes-tQuePedira).toExponential(3), r:r, ms:+(performance.now()-t0).toFixed(1)}; };

  const out=[];
  /* EL CASO DE LA HIPOTESIS: aparcado justo donde lo deja play() (instanteDecod(local)), _pedT borrado */
  out.push(await prueba('aparcado por play(), _pedT borrado', local, instanteDecod(local), true));
  /* variante: aparcado en el instante CRUDO (lo que hacia play() ANTES de R346b) */
  out.push(await prueba('aparcado en el instante CRUDO', local, local, true));
  /* CONTROL: instante DISTINTO -> tiene que resolver */
  out.push(await prueba('CONTROL instante distinto', local, 2.0, true));
  /* variante honesta: play() de verdad, pausa, y se pide el mismo instante */
  state.playhead=T; play(); await __dormir(60); pause(); await __dormir(200);
  vi._pedT=undefined;
  const t0=performance.now();
  const r=await Promise.race([ vinstSeek(c,m,local).then(()=>'RESUELVE'), __dormir(6000).then(()=>'CUELGA') ]);
  out.push({etq:'play() real + pause()', ctAntes:+v.currentTime.toFixed(9), tPedido:+instanteDecod(local).toFixed(9), identico:null, delta:'-', r:r, ms:+(performance.now()-t0).toFixed(1)});
  return {out:out};
}catch(e){ return {err:String(e&&e.stack||e).slice(0,500)}; } })()`);
console.log('');
console.log('   (2) LA PROMESA DE vinstSeekVideo, CON EL ELEMENTO YA APARCADO   <- la candidata 2');
if (p2.err) console.log('       *** ' + p2.err);
else for (const x of p2.out) {
  console.log('       ' + x.etq.padEnd(36) + ' ct antes=' + x.ctAntes + ' t pedido=' + x.tPedido
    + ' identico=' + (x.identico === null ? '?' : (x.identico ? 'SI' : 'no (' + x.delta + ')'))
    + '  -> ' + x.r + ' en ' + x.ms + ' ms');
}
console.log('');
console.log('errs JS: ' + JSON.stringify(await ev(`window.__errs?window.__errs.slice(0,3):[]`)));
ws.close();
