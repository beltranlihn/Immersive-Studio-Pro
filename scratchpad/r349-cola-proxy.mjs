/* [R349·RED] «Generar proxy» del menu contextual NO encola nada.

   El manejador del menu (app.js, entrada «Generar proxy»/«Regenerar proxy») hace, por cada medio:
       v.proxyReady=false; v.proxyPct=0; v._pxGen=true; ... enqProxy(v);
   y `enqProxy` empieza por  `if(!m||m._pxGen||proxyQ.includes(m))return;`  — o sea que la marca que el propio
   llamador acaba de poner cierra la puerta y el medio NUNCA entra en la cola. La barra se queda en 0 % con «…»
   para siempre, que es exactamente el sintoma: «se queda pegado al inicio».

   La marca es de antes de R326; R326 escribio la guarda sobre esa misma propiedad sin ver que un llamador ya la
   ponia, y R327 (que la puso ademas en `pumpProxy`) tampoco lo miro. `makeProxy` en si funciona: se comprueba
   aparte en `r349-proxy.mjs`, y genera de punta a punta tambien con material pesado real.

   Esta sonda mide la CONCLUSION —¿acaba habiendo un proxy?—, no la premisa, y sabe fallar: reconstruye el estado
   anterior al arreglo (poniendo `_pxGen` a mano antes de encolar) y exige que ESE caso se vea rojo.

   Uso:  npx electron . --remote-debugging-port=9222   y luego  node scratchpad/r349-cola-proxy.mjs
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
const ev = x => new Promise(r => { const i = ++id; pend.set(i, m => r(m.result && m.result.exceptionDetails ? ('EXC ' + (m.result.exceptionDetails.exception?.description || '').slice(0, 500)) : (m.result && m.result.result && m.result.result.value))); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: x, awaitPromise: true, returnByValue: true, timeout: 180000 } })); });

/* viejo=true reconstruye el estado anterior al arreglo: la marca puesta ANTES de encolar. */
const PAGINA = (viejo) => `(async()=>{ let m=null; try{
  const RUTA=${JSON.stringify(RUTA)};
  const url='file:///'+encodeURI(RUTA);
  const v=document.createElement('video'); v.src=url; v.muted=true; v.playsInline=true; v.preload='auto';
  await new Promise((res,rej)=>{ v.addEventListener('loadedmetadata',res,{once:true}); v.addEventListener('error',()=>rej(new Error('no carga')),{once:true}); setTimeout(()=>rej(new Error('metadata timeout')),10000); });
  const st=await DSP.stat(RUTA);
  m={id:uid(),name:'r349-'+(${viejo}?'viejo':'hoy')+'.mp4',kind:'video',el:v,originalEl:v,srcUrl:url,tex:newTex(),
     w:v.videoWidth,h:v.videoHeight,dur:v.duration,fps:24,thumb:null,color:'#888',
     proxyReady:false,proxyPct:0,path:RUTA,fsize:(st&&st.size)||0,folder:null};
  state.media.push(m);
  /* Exactamente lo que hace el manejador del menu, salvo la marca, que es lo que se prueba. */
  m.proxyReady=false; m.proxyPct=0; if(${viejo})m._pxGen=true; m._proxyForce=true;
  enqProxy(m);
  const encolado=(proxyQ.indexOf(m)>=0);
  /* 25 s de margen: el caso verde tarda menos de 1 s con este material, y el rojo no avanza NUNCA (no hay nada
     que esperar). Mas plazo solo alargaria la tanda de redes. */
  const t0=performance.now();
  while(!m.proxyReady && m.proxyPct>=0 && performance.now()-t0<25000) await new Promise(r=>setTimeout(r,120));
  return JSON.stringify({encolado:encolado, listo:!!m.proxyReady, pct:m.proxyPct, ms:Math.round(performance.now()-t0)});
}catch(e){ return 'ERR '+String((e&&e.message)||e).slice(0,400);
} finally { if(m)state.media=state.media.filter(x=>x!==m); } })()`;

console.log('');
console.log('R349 - «Generar proxy» del menu contextual: de la pulsacion al proxy en disco');
let malas = [];
for (const viejo of [true, false]) {
  const r = await ev(PAGINA(viejo));
  let o = null; try { o = JSON.parse(r); } catch (e) { console.log('   *** ' + String(r).slice(0, 400)); malas.push('no se pudo medir'); continue; }
  const et = viejo ? 'ESTADO ANTERIOR (la marca puesta antes de encolar)' : 'COMO ESTA HOY';
  console.log('');
  console.log('   ' + et);
  console.log('      entro en la cola: ' + o.encolado + ' · proxy listo: ' + o.listo + ' · pct=' + o.pct + ' · ' + o.ms + ' ms');
  if (viejo) { if (o.listo) malas.push('la red NO sabe fallar: con la marca puesta antes de encolar el proxy se generaba igual'); else console.log('      -> rojo, como debe: la marca cierra `enqProxy` y no se genera nada'); }
  else { if (!o.listo) malas.push('«Generar proxy» no produce proxy: pct=' + o.pct + ' tras ' + o.ms + ' ms'); else console.log('      -> verde: el proxy se genera'); }
}
console.log('');
for (const x of malas) console.log('   *** ' + x);
ws.close();
process.exitCode = malas.length ? 1 : 0;
