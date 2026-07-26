// Capturas del launcher en los 3 formatos + medidas de tamaño de texto.
import { targets } from './cdp.mjs';
import fs from 'fs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 300; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
if (!idx) { console.log('sin ventana'); process.exit(1); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.exceptionThrown') errs.push(((x.params.exceptionDetails.exception || {}).description || '').slice(0, 150)); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 120000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 250) }; return r.result.value; };
for (let i = 0; i < 120; i++) { if (await evl('typeof state!=="undefined"') === true) break; await wait(400); }
await wait(1200);

await evl(`(()=>{ if(!document.getElementById('landingOv')) showLanding(); return true; })()`);
await wait(900);

for (const t of ['dome', 'flat', 'room']) {
  await evl(`(()=>{ _lch.ptype='${t}'; renderLauncher(); return true; })()`);
  await wait(900);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`scratchpad/lch-${t}.png`, Buffer.from(shot.data, 'base64'));
  console.log(`lch-${t}.png`);
}

console.log('\nmedidas (px CSS):', JSON.stringify(await evl(`(()=>{
  const ov=document.getElementById('landingOv');
  const g=s=>{const e=ov.querySelector(s); if(!e)return null; const c=getComputedStyle(e); return {fs:c.fontSize,color:c.color,bg:c.backgroundColor};};
  const pane=ov.querySelector('.lch-pane');
  return { h1:g('.lch-hero h1'), panel:g('.lch-panel'), visor:g('.lch-viewer'),
    fondoPagina:getComputedStyle(ov).background.slice(0,60),
    fondoDelPane:pane?getComputedStyle(pane).backgroundColor:null,
    hayScroll:document.documentElement.scrollHeight>window.innerHeight+2 }; })()`), null, 1));

console.log('\nerrores:', errs.length ? errs.slice(0, 5) : 'ninguno');
ws.close();
