/* [R349] ¿Por que «no se estan generando proxys»? Se pide uno de punta a punta y se mira QUE excepcion sale.
   `pumpProxy` traga el error en un `catch` que solo pone `proxyPct=-1`, y la interfaz pinta ese -1 como una barra
   a cero con «…»: un fallo se ve EXACTAMENTE igual que «empezando». Por eso el sintoma es «se queda pegado al
   inicio». Aqui se llama a `makeProxy` a pelo, sin el `catch`, y se imprime el error.

   Uso:  npx electron . --remote-debugging-port=9222   y luego  node scratchpad/r349-proxy.mjs
*/
import http from 'http';
import { existsSync } from 'fs';

const S = 'C:/Users/beltr/Desktop/Alma Digital Studio/Projects/Immersive Studio Pro/scratchpad/media/';
const ARCHIVOS = (process.argv.length > 2 ? process.argv.slice(2) : [S + 'tunel-control.mp4', S + 'ms-24.mp4']).filter(p => existsSync(p));
if (!ARCHIVOS.length) { console.log('   NO MEDIDA: no hay material'); process.exit(3); }

const lista = await new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: 9222, path: '/json/list' }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res(JSON.parse(b))); }).on('error', rej); });
const pg = lista.find(x => x.type === 'page' && /index\.html/.test(x.url));
if (!pg) { console.log('*** la app no esta escuchando en 9222'); process.exit(2); }
const ws = new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const ev = x => new Promise(r => { const i = ++id; pend.set(i, m => r(m.result && m.result.exceptionDetails ? ('EXC ' + (m.result.exceptionDetails.exception?.description || '').slice(0, 600)) : (m.result && m.result.result && m.result.result.value))); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: x, awaitPromise: true, returnByValue: true, timeout: 180000 } })); });

const PAGINA = (ruta) => `(async()=>{ try{
  const RUTA=${JSON.stringify(ruta)};
  const url='file:///'+encodeURI(RUTA);
  const v=document.createElement('video'); v.src=url; v.muted=true; v.playsInline=true; v.preload='auto';
  await new Promise((res,rej)=>{ v.addEventListener('loadedmetadata',res,{once:true}); v.addEventListener('error',()=>rej(new Error('no carga')),{once:true}); setTimeout(()=>rej(new Error('metadata timeout')),10000); });
  const st=await DSP.stat(RUTA);
  const m={id:uid(),name:RUTA.split('/').pop(),kind:'video',el:v,originalEl:v,srcUrl:url,tex:newTex(),
           w:v.videoWidth,h:v.videoHeight,dur:v.duration,fps:30,thumb:null,color:'#888',
           proxyReady:false,proxyPct:0,path:RUTA,fsize:(st&&st.size)||0,folder:null};
  state.media.push(m);
  await new Promise(r=>detectFps(v,m,r));
  const fpsDet=m.fps;
  m._proxyForce=true;                      /* saltarse un proxy ya cacheado: queremos GENERAR */
  const t0=performance.now();
  let err=null; try{ await makeProxy(m); }catch(e){ err=(e&&(e.stack||e.message))||String(e); }
  const ms=Math.round(performance.now()-t0);
  const res={fps:fpsDet, ms:ms, listo:!!m.proxyReady, pct:m.proxyPct, url:!!m.proxyUrl, ruta:m.proxyPath||null, err:err};
  state.media=state.media.filter(x=>x!==m);
  return JSON.stringify(res);
}catch(e){ return 'ERR '+String((e&&(e.stack||e.message))||e).slice(0,600); } })()`;

console.log('');
console.log('R349 - generacion de proxy de punta a punta');
let malas = 0;
for (const a of ARCHIVOS) {
  const r = await ev(PAGINA(a));
  let o = null; try { o = JSON.parse(r); } catch (e) { console.log('   ' + a.split('/').pop() + '  *** ' + String(r).slice(0, 600)); malas++; continue; }
  console.log('');
  console.log('   ' + a.split('/').pop() + '   fps detectados: ' + o.fps + ' · ' + o.ms + ' ms');
  if (o.err) { console.log('      *** EXCEPCION: ' + String(o.err).slice(0, 500)); malas++; }
  else console.log('      proxyReady=' + o.listo + ' · pct=' + o.pct + ' · url=' + o.url + ' · ruta=' + o.ruta);
  if (!o.err && !o.listo) { console.log('      *** termino SIN error y SIN proxy listo'); malas++; }
}
console.log('');
ws.close();
process.exitCode = malas ? 1 : 0;
