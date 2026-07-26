// [R175] Arrancar la app CON un proyecto, como el doble clic del vídeo, y comprobar que:
//   · el editor NO se revela hasta que el proyecto está montado
//   · no aparece la segunda pantalla de carga (#loadingOv) encima del editor
//   · el splash cuenta el avance real
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
const t0 = Date.now();
let idx = null;
for (let i = 0; i < 300; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
if (!idx) { console.log('sin editor'); process.exit(1); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 250) }; return r.result.value; };

// muestrear el estado del arranque a lo largo del tiempo
const linea = [];
let vioLanding = false, vioLoadingOv = false, revelado0 = null, proyecto0 = null;
for (let i = 0; i < 140; i++) {
  const s = await evl(`(()=>{ if(typeof state==='undefined')return null;
    return { preboot:document.body.classList.contains('preboot'),
      loadingOv:!!document.getElementById('loadingOv'),
      esperando:(typeof _bootEsperandoProyecto!=='undefined')?_bootEsperandoProyecto:null,
      revelado:(typeof _bootRevelado!=='undefined')?_bootRevelado:null,
      pct:(typeof _bootPct!=='undefined')?_bootPct:null,
      clips:state.clips.length, medios:state.media.length,
      landing:!!document.getElementById('landingOv'),
      cargando:state.media.filter(m=>m._loading&&!m.missing).length }; })()`);
  if (s && !s.ROTO) {
    if (s.loadingOv) vioLoadingOv = true;
    if (s.landing) vioLanding = true;
    if (revelado0 === null && s.revelado) revelado0 = Date.now() - t0;
    if (proyecto0 === null && s.clips > 0) proyecto0 = Date.now() - t0;
    linea.push({ t: Date.now() - t0, ...s });
    console.log(String(Date.now()-t0).padStart(6)+"ms  preboot="+(s.preboot?1:0)+" esperando="+s.esperando+" revelado="+s.revelado+" pct="+s.pct+" loadingOv="+(s.loadingOv?1:0)+" launcher="+(s.landing?1:0)+" clips="+s.clips);
    if (s.revelado && s.clips > 0 && !s.cargando && (Date.now() - t0) > 4000) break;
  }
  await wait(200);
}
const fin = linea[linea.length - 1] || {};
console.log('muestras:', linea.length);
console.log('· segunda pantalla de carga sobre el editor:', vioLoadingOv ? '✗ APARECIÓ' : '✓ no apareció');
console.log('· launcher visible en algún momento:', vioLanding?'✗ SÍ (parpadeo)':'✓ nunca');
console.log('· editor revelado a los:', revelado0 != null ? (revelado0 / 1000).toFixed(1) + 's' : 'nunca');
console.log('· proyecto con clips a los:', proyecto0 != null ? (proyecto0 / 1000).toFixed(1) + 's' : 'nunca');
console.log('· ¿reveló DESPUÉS de tener el proyecto?:', (revelado0 != null && proyecto0 != null && revelado0 >= proyecto0) ? '✓ sí' : '✗ NO');
console.log('· estado final:', JSON.stringify({ preboot: fin.preboot, clips: fin.clips, medios: fin.medios, cargando: fin.cargando, pct: fin.pct }));
console.log('\navance del splash:', [...new Set(linea.map(x => x.pct))].join(' → '));
ws.close();
