// ¿scrollea el launcher a distintas alturas de ventana, en los 3 formatos?
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 300; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
await send('Runtime.enable', {});
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 120000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 250) }; return r.result.value; };
for (let i = 0; i < 120; i++) { if (await evl('typeof state!=="undefined"') === true) break; await wait(400); }
await wait(1000);
await evl(`(()=>{ if(!document.getElementById('landingOv')) showLanding(); return true; })()`);
await wait(700);

for (const h of [780, 900, 1000, 1200]) {
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: h, deviceScaleFactor: 1, mobile: false });
  await wait(450);
  const out = {};
  for (const t of ['dome', 'flat', 'room']) {
    await evl(`(()=>{ _lch.ptype='${t}'; renderLauncher(); return true; })()`);
    await wait(500);
    out[t] = await evl(`(()=>{ const d=document.documentElement;
      const w=document.querySelector('.lch-work'); const r=w?w.getBoundingClientRect():null;
      return { scroll:d.scrollHeight-window.innerHeight, work:r?Math.round(r.height):null,
               recientesVisibles:(()=>{ const e=document.getElementById('lchRecents'); if(!e)return null; const b=e.getBoundingClientRect(); return b.bottom<=window.innerHeight+1; })() }; })()`);
  }
  const alturasIguales = new Set(Object.values(out).map(o => o.work)).size === 1;
  console.log(`ventana ${h}px →`, JSON.stringify(out), ' alto igual en los 3:', alturasIguales);
}
await send('Emulation.clearDeviceMetricsOverride', {});
ws.close();
