// Tras el cambio de arranque: ¿el editor queda sano? (sin errores de consola, landing pintado, GL vivo, 16:9)
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 100; i++) {
  const list = await targets(9222).catch(() => []);
  idx = list.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl);
  if (idx) break; await wait(150);
}
if (!idx) { console.log('sin editor'); process.exit(1); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true }); if (r.exceptionDetails) throw new Error('threw'); return r.result.value; };
const errors = [];
await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errors.push((x.params.args || []).map(a => a.value || a.description || '').join(' ')); });
await wait(2500);
const out = await evl(`(()=>{
  const glc=document.getElementById('gl'); const g=glc&&(glc.getContext('webgl2'));
  return { viewport:[innerWidth,innerHeight], ratio:+(innerWidth/innerHeight).toFixed(4),
    preboot:document.body.classList.contains('preboot'),
    landing:!!document.getElementById('landingOv'), splashViejo:!!document.getElementById('splashOv'),
    showSplashExiste:(typeof showSplash!=='undefined'),
    glPerdido: g? g.isContextLost() : 'sin ctx',
    lanes:document.querySelectorAll('#laneHeaders .lanehdr').length,
    statusHint:(document.getElementById('statInfo')||{}).textContent };
})()`);
console.log(JSON.stringify(out, null, 2));
console.log('ERRORS:', errors.length ? errors : 'none');
ws.close();
