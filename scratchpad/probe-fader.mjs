import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 120; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error('threw: ' + JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false, screenWidth: 1600, screenHeight: 900 });
await send('Page.reload', { ignoreCache: true }); await wait(1900);
for (let i = 0; i < 60; i++) { try { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")')) break; } catch (e) {} await wait(400); }
await evl(`(()=>{ try{localStorage.setItem('dspOnboardV1','1')}catch(e){} document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove()); document.body.classList.remove('preboot'); try{resize();}catch(e){} return 1; })()`);
await evl(`(async()=>{ await buildDemoProject(); const c=state.clips.find(x=>{const m=mediaById(x.mediaId);return m&&m.kind!=='audio';})||state.clips[0]; state.selIds=[c.id]; state.selId=c.id; renderInspector(); return 1; })()`);
await wait(800);
console.log(JSON.stringify(await evl(`(()=>{
  const rows=document.querySelectorAll('#insCtl .prow');
  if(!rows.length) return {sinFilas:true, insCtl:getComputedStyle(document.getElementById('insCtl')).display};
  const row=[...rows].find(r=>r.querySelector('.track')&&r.getBoundingClientRect().width>0); if(!row)return {sinFader:true, filas:rows.length, conTrack:[...rows].filter(r=>r.querySelector('.track')).length, hosts:[...document.querySelectorAll('#insCtl > div')].map(d=>d.id+':'+d.querySelectorAll('.prow').length)};
  const R=el=>el?Math.round(el.getBoundingClientRect().width):null;
  return { filas:rows.length, fila:R(row), etiqueta:R(row.querySelector('.lab')), fader:R(row.querySelector('.track')),
    caja:R(row.querySelector('.box')), nav:R(row.querySelector('.nav')),
    botonesNav:row.querySelectorAll('.nav button').length,
    panelInspector:R(document.getElementById('inspPane')) };
})()`), null, 2));
ws.close();
