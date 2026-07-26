// [R175b] Arranque abriendo un .isp que TIENE autoguardado más nuevo (sale el diálogo de recuperación).
// Se comprueba: (1) el launcher no parpadea, (2) si aparece un diálogo el editor YA está revelado —si no, la
// pregunta quedaría dentro de la ventana oculta—, y (3) tras responder, no hay segunda pantalla de carga.
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
const t0 = Date.now();
let idx = null;
for (let i = 0; i < 300; i++) { const l = await targets(9223).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
if (!idx) { console.log('sin editor'); process.exit(1); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 250) }; return r.result.value; };

let vioLanding = false, vioLoadingOv = false, dialogo = null, respondido = false, revelado = null, conClips = null;
for (let i = 0; i < 160; i++) {
  const s = await evl(`(()=>{ if(typeof state==='undefined')return null;
    const cf=document.getElementById('confirmOv');
    return { landing:!!document.getElementById('landingOv'), loadingOv:!!document.getElementById('loadingOv'),
      preboot:document.body.classList.contains('preboot'),
      revelado:(typeof _bootRevelado!=='undefined')?_bootRevelado:null,
      dialogo:!!cf, clips:state.clips.length,
      cargando:state.media.filter(m=>m._loading&&!m.missing).length }; })()`);
  if (s && !s.ROTO) {
    if (s.landing) vioLanding = true;
    if (s.loadingOv) vioLoadingOv = true;
    if (revelado === null && s.revelado) revelado = Date.now() - t0;
    if (conClips === null && s.clips > 0) conClips = Date.now() - t0;
    if (s.dialogo && !dialogo) dialogo = { t: Date.now() - t0, prebootAlSalir: s.preboot, reveladoAlSalir: !!s.revelado };
    if (s.dialogo && !respondido) {                      // responder «abrir el archivo» (no restaurar)
      await evl(`(()=>{const b=document.querySelector('#confirmOv #cfCancel'); if(b)b.click(); return 1})()`);
      respondido = true;
    }
    if (s.revelado && s.clips > 0 && !s.cargando && Date.now() - t0 > 4000) break;
  }
  await wait(200);
}
console.log('· launcher visible en algún momento: ' + (vioLanding ? '✗ SÍ (parpadeo)' : '✓ nunca'));
console.log('· segunda pantalla de carga: ' + (vioLoadingOv ? '✗ APARECIÓ' : '✓ no apareció'));
if (dialogo) console.log('· diálogo de autoguardado a los ' + (dialogo.t / 1000).toFixed(1) + 's — editor revelado al salir: ' + (dialogo.reveladoAlSalir ? '✓ sí (se ve)' : '✗ NO (quedaría oculto)'));
else console.log('· diálogo de autoguardado: no salió en esta ejecución');
console.log('· editor revelado: ' + (revelado != null ? (revelado / 1000).toFixed(1) + 's' : 'nunca') + ' · clips: ' + (conClips != null ? (conClips / 1000).toFixed(1) + 's' : 'nunca'));
console.log('· estado final: ' + JSON.stringify(await evl(`({clips:state.clips.length,medios:state.media.length,preboot:document.body.classList.contains('preboot')})`)));
ws.close();
