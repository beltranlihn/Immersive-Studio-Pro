// Comprueba que el visor 3D del launcher se adapta al ángulo del domo: capturas a 180 / 200 / 220.
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
await send('Page.enable', {});
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false, screenWidth: 1600, screenHeight: 1000 });
await evl(`(()=>{ if(!document.getElementById('landingOv'))showLanding(); _lch.ptype='dome'; renderLauncher(); return 1; })()`);
await wait(600);
const out = [];
for (const cov of [180, 200, 220]) {
  await evl(`(()=>{ _lch.domeCov=${cov}; _lch.draft={}; renderLauncher(); return 1; })()`);
  await wait(700);
  const box = await evl(`(()=>{ const p=document.getElementById('lchCvDome3d').parentElement; const b=p.getBoundingClientRect();
    return {x:Math.round(b.x),y:Math.round(b.y),width:Math.round(b.width),height:Math.round(b.height)}; })()`);
  const c = await send('Page.captureScreenshot', { format: 'png', clip: { ...box, scale: 1 } });
  fs.writeFileSync('scratchpad/dome3d-' + cov + '.png', Buffer.from(c.data, 'base64'));
  // firma numérica: cuántos píxeles pintados hay por debajo del centro (más cobertura = más superficie abajo)
  const sig = await evl(`(()=>{ const cv=document.getElementById('lchCvDome3d'); const g=cv.getContext('2d');
    const d=g.getImageData(0,Math.round(cv.height*0.55),cv.width,Math.round(cv.height*0.45)).data; let n=0;
    for(let i=0;i<d.length;i+=4*13) if(d[i]>18) n++; return n; })()`);
  out.push({ cov, pixelesBajoElCentro: sig });
}
console.log(JSON.stringify(out, null, 2));
ws.close();
