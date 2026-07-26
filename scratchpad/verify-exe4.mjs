// ¿el .exe EMPAQUETADO trae R173-R175? Con el arranque real: se lanza abriendo un .isp.
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
const t0 = Date.now();
let idx = null;
for (let i = 0; i < 300; i++) { const l = await targets(9223).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
if (!idx) { console.log('el .exe no expuso la ventana'); process.exit(1); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data);
  if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errs.push((x.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 180));
  if (x.method === 'Runtime.exceptionThrown') errs.push('excepción: ' + ((x.params.exceptionDetails.exception && x.params.exceptionDetails.exception.description) || '').slice(0, 180)); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 250) }; return r.result.value; };

// R175 · seguir el arranque desde donde se pueda enganchar
let vioLoadingOv = false, revelado = null, conClips = null;
for (let i = 0; i < 90; i++) {
  const s = await evl(`(()=>{ if(typeof state==='undefined')return null;
    return { loadingOv:!!document.getElementById('loadingOv'), preboot:document.body.classList.contains('preboot'),
      revelado:(typeof _bootRevelado!=='undefined')?_bootRevelado:null, pct:(typeof _bootPct!=='undefined')?_bootPct:null,
      clips:state.clips.length, cargando:state.media.filter(m=>m._loading&&!m.missing).length }; })()`);
  if (s && !s.ROTO) {
    if (s.loadingOv) vioLoadingOv = true;
    if (revelado === null && s.revelado) revelado = Date.now() - t0;
    if (conClips === null && s.clips > 0) conClips = Date.now() - t0;
    if (s.revelado && s.clips > 0 && !s.cargando && Date.now() - t0 > 3500) break;
  }
  await wait(200);
}
console.log('R175 · arranque con proyecto:');
console.log('   segunda pantalla de carga: ' + (vioLoadingOv ? '✗ APARECIÓ' : '✓ no apareció'));
console.log('   editor revelado: ' + (revelado != null ? (revelado / 1000).toFixed(1) + 's' : 'nunca') + ' · proyecto con clips: ' + (conClips != null ? (conClips / 1000).toFixed(1) + 's' : 'nunca'));

console.log('\n' + JSON.stringify(await evl(`(()=>{ const R={};
  R['R173 · alternancia de menús'] = [typeof dentroDe, typeof rectDe].join('/') + ' · sello=' + (typeof _ptrSeq!=='undefined');
  R['R174 · sin Safe'] = !document.querySelector('#dispSeg button[data-d=safe]');
  R['R174 · superposiciones'] = [...document.querySelectorAll('#dispSeg button')].map(b=>b.dataset.d).join(',');
  R['R174 · sólo icono'] = [...document.querySelectorAll('#dispSeg .vlbl')].every(s=>getComputedStyle(s).display==='none');
  R['R174 · DIST/DOLLY fuera'] = [getComputedStyle(document.getElementById('distCtl')).display, getComputedStyle(document.getElementById('dollyCtl')).display].join('/');
  R['R175 · puente bootProject'] = typeof (window.dsp&&window.dsp.bootProject);
  R['proyecto cargado'] = { clips:state.clips.length, medios:state.media.length, ruta:(typeof currentPath!=='undefined'&&!!currentPath) };
  R['render'] = (()=>{try{render();return !(gl&&gl.isContextLost&&gl.isContextLost())}catch(e){return 'ROTO'}})();
  return R; })()`), null, 2));
await wait(400);
console.log('errores de consola en el .exe:', errs.length ? errs : 'ninguno');
ws.close();
