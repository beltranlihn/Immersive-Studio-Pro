// [R178] La barra vertical: (1) no invade la franja de la regla, (2) achica Y AGRANDA — incluso después de
// haber plegado las pistas, que es donde fallaba.
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 150; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(200); }
if (!idx) { console.log('sin editor'); process.exit(1); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errs.push((x.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 200)); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 300) }; return r.result.value; };
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1600, screenHeight: 900 });
await send('Page.reload', { ignoreCache: true }); await wait(2600);
for (let i = 0; i < 80; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await evl(`(()=>{try{localStorage.setItem('dspOnboardV1','1')}catch(e){}document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove());document.body.classList.remove('preboot');try{resize()}catch(e){}return 1})()`);
await evl(`(async()=>{state.dirty=false;await buildDemoProject();return 1})()`); await wait(900);

console.log('geometría', JSON.stringify(await evl(`(()=>{ const R=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {top:Math.round(r.top),bottom:Math.round(r.bottom)};};
  const b=R('#tlVZoom'), rg=R('#rulerCv'), pn=R('.timeline');
  return { barra:b, regla:rg, panel:pn,
    invadeLaRegla: b.top < rg.bottom, llegaAbajo: Math.abs(b.bottom-pn.bottom)<2 }; })()`)));

const cap = async lado => evl(`(()=>{const c=document.querySelector('#tlVZoom .tlvzcap.${lado}'); if(!c)return null; const r=c.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};})()`);
const arrastrar = async (p, dy) => {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
  const pasos = 10;
  for (let k = 1; k <= pasos; k++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y + Math.round(dy * k / pasos), button: 'left' }); await wait(30); }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y + dy, button: 'left', clickCount: 1 });
  await wait(350);
};
const alturas = () => evl(`state.lanes.map((l,i)=>laneH(i)+(l.collapsed?'·plegada':''))`);

console.log('inicio   ', JSON.stringify(await alturas()));
let b = await cap('b');
await arrastrar(b, -140);                                   // hacia arriba = achicar
console.log('achicar  ', JSON.stringify(await alturas()));
b = await cap('b');
await arrastrar(b, 200);                                    // hacia abajo = agrandar
const tras = await alturas();
console.log('agrandar ', JSON.stringify(tras));
const creció = JSON.stringify(tras) !== JSON.stringify(await evl(`state.lanes.map(()=>24)`)) && tras.every(x => !String(x).includes('plegada'));
console.log('\nveredicto: agranda tras haber achicado → ' + (creció ? '✓ sí' : '✗ NO'));
await wait(300);
console.log('errores:', errs.length ? errs : 'ninguno');
ws.close();
