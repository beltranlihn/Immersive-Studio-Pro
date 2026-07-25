// Se engancha al splash apenas existe y muestrea su estado (barra, texto, escala, medidas del diseño).
import { targets } from './cdp.mjs';
import fs from 'fs';
const wait = ms => new Promise(r => setTimeout(r, ms));

let spl = null;
for (let i = 0; i < 120; i++) {
  const list = await targets(9222).catch(() => []);
  spl = list.find(t => t.type === 'page' && /splash\.html/.test(t.url || '') && t.webSocketDebuggerUrl);
  if (spl) break;
  await wait(120);
}
if (!spl) { console.log('el splash no apareció'); process.exit(1); }

const ws = new WebSocket(spl.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
// la ventana del splash se cierra sola a mitad del muestreo: toda llamada lleva timeout y el socket avisa al cerrar
let closed = false;
ws.addEventListener('close', () => { closed = true; });
const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
const evl = async e => { const r = await withTimeout(send('Runtime.evaluate', { expression: e, returnByValue: true }).catch(() => null), 700); return r && r.result && r.result.value; };

const samples = [];
const t0 = Date.now();
let geo = null, shot = null;
for (let i = 0; i < 60 && !closed; i++) {
  try {
    const s = await evl(`(()=>{ const c=document.getElementById('card'); if(!c) return {pendiente:true};
      const f=document.getElementById('fill'), st=document.getElementById('status');
      return { w:f?f.style.width:null, status:st?st.textContent:null, bye:c.className }; })()`);
    if (!s) { await wait(180); continue; }          // la página todavía no pintó: reintentar, no abandonar
    if (s.pendiente) { await wait(120); continue; }
    samples.push({ ms: Date.now() - t0, ...s });
    if (!geo) {
      geo = await evl(`(()=>{ const c=document.getElementById('card'); const cs=getComputedStyle(c);
        const R=el=>{const b=el.getBoundingClientRect();return {w:Math.round(b.width),h:Math.round(b.height)};};
        const b=c.getBoundingClientRect();
        return { ventana:[innerWidth,innerHeight], lienzoCSS:[c.offsetWidth,c.offsetHeight], transform:cs.transform,
          pintado:R(c), caja:{x:Math.round(b.x),y:Math.round(b.y),r:Math.round(b.right),b:Math.round(b.bottom)},
          centrado:(Math.abs(b.x)<1.5 && Math.abs(b.right-innerWidth)<1.5),
          padding:cs.padding, radius:cs.borderRadius,
          logo:R(document.querySelector('.mark')), pill:R(document.querySelector('.edition')),
          nombre:getComputedStyle(document.querySelector('.pname')).fontSize,
          build:document.getElementById('build').textContent,
          statusH:getComputedStyle(document.getElementById('status')).height,
          barra:R(document.querySelector('.track')) }; })()`);
    }
    if (!shot && samples.length > 3) {
      const c = await send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
      if (c) { fs.writeFileSync('scratchpad/splash-live.png', Buffer.from(c.data, 'base64')); shot = true; }
    }
  } catch (e) { break; }
  await wait(180);
}
const res = { geometria: geo, muestras: samples.filter((s, i) => i % 3 === 0 || i === samples.length - 1) };
fs.writeFileSync('scratchpad/probe-splash-live.json', JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 2));
try { ws.close(); } catch (_) {}
