// ¿el .exe EMPAQUETADO trae R176? Se mide también la VENTANA del splash, que vive en el proceso principal.
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
const t0 = Date.now();

// el splash es otra página: se le mira el tamaño mientras existe
let splashLado = null;
for (let i = 0; i < 60; i++) {
  const l = await targets(9223).catch(() => []);
  const sp = l.find(t => t.type === 'page' && /splash\.html/.test(t.url || ''));
  if (sp && sp.webSocketDebuggerUrl) {
    try {
      const w = new WebSocket(sp.webSocketDebuggerUrl);
      await new Promise((r, j) => { w.onopen = r; w.onerror = () => j(new Error('ws')); });
      const res = await new Promise(r => { const h = ev => { const x = JSON.parse(ev.data); if (x.id === 1) { w.removeEventListener('message', h); r(x.result); } }; w.addEventListener('message', h); w.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: '({w:innerWidth,h:innerHeight})', returnByValue: true } })); });
      splashLado = res && res.result && res.result.value; w.close();
    } catch (e) {}
    break;
  }
  await wait(120);
}
console.log('splash (ventana): ' + (splashLado ? splashLado.w + '×' + splashLado.h + 'px' : 'no se pudo medir (ya se había cerrado)'));

let idx = null;
for (let i = 0; i < 300; i++) { const l = await targets(9223).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
if (!idx) { console.log('el .exe no expuso la ventana del editor'); process.exit(1); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data);
  if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errs.push((x.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 180));
  if (x.method === 'Runtime.exceptionThrown') errs.push('excepción: ' + ((x.params.exceptionDetails.exception && x.params.exceptionDetails.exception.description) || '').slice(0, 180)); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 250) }; return r.result.value; };

let vioLanding = false, vioLoadingOv = false, revelado = null, conClips = null;
for (let i = 0; i < 120; i++) {
  const s = await evl(`(()=>{ if(typeof state==='undefined')return null;
    return { landing:!!document.getElementById('landingOv'), loadingOv:!!document.getElementById('loadingOv'),
      revelado:(typeof _bootRevelado!=='undefined')?_bootRevelado:null, clips:state.clips.length,
      cargando:state.media.filter(m=>m._loading&&!m.missing).length }; })()`);
  if (s && !s.ROTO) {
    if (s.landing) vioLanding = true;
    if (s.loadingOv) vioLoadingOv = true;
    if (revelado === null && s.revelado) revelado = Date.now() - t0;
    if (conClips === null && s.clips > 0) conClips = Date.now() - t0;
    if (s.revelado && s.clips > 0 && !s.cargando && Date.now() - t0 > 4000) break;
  }
  await wait(200);
}
console.log('arranque: launcher ' + (vioLanding ? '✗ apareció' : '✓ nunca') + ' · segunda pantalla ' + (vioLoadingOv ? '✗ apareció' : '✓ nunca')
  + ' · editor ' + (revelado != null ? (revelado / 1000).toFixed(1) + 's' : '?') + ' · clips ' + (conClips != null ? (conClips / 1000).toFixed(1) + 's' : '?'));

console.log('\n' + JSON.stringify(await evl(`(()=>{ const R={};
  R['R176 · puntos de la barra vertical'] = (()=>{ const c=[...document.querySelectorAll('#tlVZoom .tlvzcap')]; return c.length+' ('+c.map(x=>x.dataset.vcap).join(',')+')'; })();
  R['R176 · sin fmtV (0/100 fuera)'] = !/const fmtV=/.test(''+drawAutoCurve);
  R['R176 · autoguardado aplazado'] = /_bootEsperandoProyecto/.test(''+maybeOfferAutosave);
  R['R174 · superposiciones'] = [...document.querySelectorAll('#dispSeg button')].map(b=>b.dataset.d).join(',');
  R['proyecto'] = { clips:state.clips.length, medios:state.media.length };
  R['render'] = (()=>{try{render();return !(gl&&gl.isContextLost&&gl.isContextLost())}catch(e){return 'ROTO'}})();
  return R; })()`), null, 2));
await wait(400);
console.log('errores de consola en el .exe:', errs.length ? errs : 'ninguno');
ws.close();
