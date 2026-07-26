// Verifica que al alternar 2D / 3D-Orbit / 3D-Viewer NO se muevan los controles que persisten.
import { targets } from './cdp.mjs';
import fs from 'fs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 140; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
if (!idx) { console.log('sin editor'); process.exit(1); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true }); if (r.exceptionDetails) throw new Error('threw: ' + JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; };
const errors = [];
await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errors.push((x.params.args || []).map(a => a.value || a.description || '').join(' ')); });
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false, screenWidth: 1920, screenHeight: 1080 });
await send('Page.reload', { ignoreCache: true }); await wait(1800);
for (let i = 0; i < 60; i++) { try { if (await evl('typeof state!=="undefined" && !!document.getElementById("tracks")')) break; } catch (e) {} await wait(400); }
await evl(`(()=>{ try{localStorage.setItem('dspOnboardV1','1')}catch(e){} document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove()); document.body.classList.remove('preboot'); try{resize();}catch(e){} return 1; })()`);
await wait(400);
const pos = () => evl(`(()=>{ const g={}; for(const id of ['viewModeSeg','dispSeg','qualitySeg','threeModeSeg','camSlot','proxyToggle','outWell','vpMoreBtn']){
  const e=document.getElementById(id); g[id]= e? {x:Math.round(e.getBoundingClientRect().x), w:Math.round(e.getBoundingClientRect().width), vis:getComputedStyle(e).display!=='none'} : null; }
  const vp=document.querySelector('.vptool'); return {g, desborda:vp.scrollWidth>vp.clientWidth+1}; })()`);
const modos = {};
await evl(`(()=>{ document.querySelector('#viewModeSeg button[data-v="2d"]').click(); return 1; })()`); await wait(500);
modos['2D'] = await pos();
await evl(`(()=>{ document.querySelector('#viewModeSeg button[data-v="3d"]').click(); return 1; })()`); await wait(700);
await evl(`(()=>{ document.querySelector('#threeModeSeg button[data-m="orbit"]').click(); return 1; })()`); await wait(500);
modos['3D Orbit'] = await pos();
await evl(`(()=>{ document.querySelector('#threeModeSeg button[data-m="spec"]').click(); return 1; })()`); await wait(500);
modos['3D Viewer'] = await pos();
// ¿se movió algo que persiste?
const persist = ['viewModeSeg', 'dispSeg', 'qualitySeg', 'proxyToggle', 'outWell'];
const keys = Object.keys(modos);
const movidos = [];
for (const p of persist) {
  const xs = keys.map(k => modos[k].g[p] && modos[k].g[p].vis ? modos[k].g[p].x : null).filter(v => v !== null);
  if (new Set(xs).size > 1) movidos.push({ control: p, x: keys.map(k => k + ':' + (modos[k].g[p] ? modos[k].g[p].x : '—')).join(' · ') });
}
console.log(JSON.stringify({ modos, seMueven: movidos.length ? movidos : 'ninguno', errores: errors.length ? errors : 'none' }, null, 2));
fs.writeFileSync('scratchpad/verify-vptool.json', JSON.stringify({ modos, movidos }, null, 2));
ws.close();
