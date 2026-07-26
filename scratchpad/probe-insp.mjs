import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 120; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('threw: ' + JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1600, screenHeight: 900 });
await send('Page.reload', { ignoreCache: true }); await wait(1900);
for (let i = 0; i < 60; i++) { try { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")')) break; } catch (e) {} await wait(400); }
await evl(`(()=>{ try{localStorage.setItem('dspOnboardV1','1')}catch(e){} document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove()); document.body.classList.remove('preboot'); try{resize();}catch(e){} return 1; })()`);
await evl(`(async()=>{ await buildDemoProject(); return 1; })()`);
await wait(500);
console.log(JSON.stringify(await evl(`(()=>{
  const info=state.clips.map(c=>{const m=mediaById(c.mediaId);return {id:c.id,media:m&&m.kind,name:c.name};});
  const vis=state.clips.find(c=>{const m=mediaById(c.mediaId);return m&&m.kind!=='audio'&&m.kind!=='adjust';});
  if(vis){ state.selIds=[vis.id]; state.selId=vis.id; renderInspector(); }
  const R=el=>el?Math.round(el.getBoundingClientRect().width):null;
  const row=[...document.querySelectorAll('#tfRows .prow')].find(r=>r.getBoundingClientRect().width>0);
  return { clips:info, seleccionado:vis&&vis.id, tfRows:document.querySelectorAll('#tfRows .prow').length,
    medida: row? { fila:R(row), etiqueta:R(row.querySelector('.lab')), fader:R(row.querySelector('.track')),
      caja:R(row.querySelector('.box')), nav:R(row.querySelector('.nav')), botones:row.querySelectorAll('.nav button').length } : 'sin fila visible' };
})()`), null, 2));
ws.close();
