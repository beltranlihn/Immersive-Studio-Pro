// [R172] Todo botón que abra un desplegable debe CERRARLO al segundo clic.
// El barrido es automático: se pulsa cada candidato, se mira si apareció un `.menu`, y si apareció se vuelve a
// pulsar para ver si se va. Se usa la rueda de eventos REAL (Input.dispatchMouseEvent) porque el arreglo depende
// del orden pointerdown → click, que un .click() sintético no reproduce.
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
await send('Page.reload', { ignoreCache: true }); await wait(2400);
for (let i = 0; i < 80; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await evl(`(()=>{try{localStorage.setItem('dspOnboardV1','1')}catch(e){}document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove());document.body.classList.remove('preboot');try{resize()}catch(e){}return 1})()`);
await evl(`(async()=>{state.dirty=false;await buildDemoProject(); const c=state.clips.find(x=>{const m=mediaById(x.mediaId);return m&&m.kind==='shape';}); if(c){state.selIds=[c.id];state.selId=c.id;} const b=document.getElementById('curvesBtn'); if(b&&!state.inlineCurves)b.click(); renderTimeline(); return 1})()`); await wait(1200);

// candidatos: todo lo pulsable y visible de las barras (sin tocar clips ni el lienzo)
const cands = await evl(`(()=>{
  const sel='button, .chip, .autoduo, .autochip, .autoctl > *, [data-menu], .selsel, .segbtn, .tnum';
  const out=[];
  for(const b of document.querySelectorAll(sel)){ if(b.closest('.menu')||b.closest('.overlay'))continue; if(b.closest('.clip'))continue;
    const r=b.getBoundingClientRect(); if(r.width<6||r.height<6)continue;
    out.push({ id:b.id||'', txt:(b.textContent||'').replace(/\\s+/g,' ').trim().slice(0,16),
      cls:(b.className||'').slice(0,20), x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2) });
  }
  return out; })()`);

const clic = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
};
const hayMenu = () => evl(`!!document.querySelector('.menu')`);

const abren = [], mal = [];
for (const c of cands) {
  await evl(`(()=>{ closeMenu(); return 1; })()`); await wait(60);
  await clic(c.x, c.y); await wait(160);
  if (!(await hayMenu())) continue;                       // este botón no abre desplegable
  await clic(c.x, c.y); await wait(200);
  const sigue = await hayMenu();
  const etq = (c.id ? '#' + c.id : c.txt || c.cls);
  abren.push(etq);
  if (sigue) mal.push(etq);
  await evl(`(()=>{ closeMenu(); return 1; })()`); await wait(60);
}
console.log('botones que abren desplegable (' + abren.length + '):', abren.join(' · ') || 'ninguno');
console.log('NO se cierran al segundo clic (' + mal.length + '):', mal.join(' · ') || 'ninguno');
console.log('errores:', errs.length ? errs : 'ninguno');
ws.close();
