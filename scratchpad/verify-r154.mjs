// Tras ensanchar los overlays (ahora con etiqueta), re-chequear que la barra del visor no desborde en ningÃºn ancho.
import { targets } from './cdp.mjs';
import fs from 'fs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 140; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true }); if (r.exceptionDetails) throw new Error('threw'); return r.result.value; };
const rows = [];
for (const w of [1920, 1600, 1440, 1280, 1150]) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: 1000, deviceScaleFactor: 1, mobile: false, screenWidth: w, screenHeight: 1000 });
  await wait(300);
  rows.push(await evl(`(()=>{ try{updViewCtl();}catch(e){}
    const vp=document.querySelector('.vptool');
    const vis=s=>{const e=document.querySelector(s);return !!(e&&getComputedStyle(e).display!=='none');};
    const used=[...vp.children].filter(c=>getComputedStyle(c).display!=='none').reduce((a,c)=>a+c.getBoundingClientRect().width,0);
    return { win:innerWidth, bar:Math.round(vp.getBoundingClientRect().width), usado:Math.round(used),
      desborda:vp.scrollWidth>vp.clientWidth+1, overlays:vis('#dispSeg'), calidad:vis('#qualitySeg'), output:vis('#outWell'), more:vis('#vpMoreBtn') }; })()`));
}
console.log(JSON.stringify(rows, null, 2));
fs.writeFileSync('scratchpad/verify-r154.json', JSON.stringify(rows, null, 2));
ws.close();

