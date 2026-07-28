// [R198] ¿cuánto se pasa el panel de la sala? (la fila del piso le añadió alto y recorta "Master output")
import { targets } from './cdp.mjs';
import { spawn } from 'child_process';
const wait = ms => new Promise(r => setTimeout(r, ms));
const ROOT = 'C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro';
const p = spawn(ROOT + '\\node_modules\\electron\\dist\\electron.exe', ['.', '--remote-debugging-port=9222'], { cwd: ROOT, stdio: 'ignore' });
let idx = null;
for (let i = 0; i < 250; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(200); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, pr) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: pr })); });
await send('Runtime.enable', {});
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 120000 }); return r.exceptionDetails ? JSON.stringify(r.exceptionDetails).slice(0, 400) : r.result.value; };
for (let i = 0; i < 150; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(2500);
await evl(`(()=>{ if(!document.getElementById('landingOv'))showLanding(); return 1; })()`);
const H = +(process.argv[2] || 0);
if (H) { await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: H, deviceScaleFactor: 1, mobile: false }); await wait(800); console.log('ventana emulada 1920x' + H); }
console.log(await evl(`(async()=>{ const out={};
  for(const t of ['dome','flat','room']){ for(const fl of (t==='room'?[true,false]:[null])){
    _lch.ptype=t; if(fl!==null)_lch.roomFloor=fl; renderLauncher(); await new Promise(r=>setTimeout(r,200));
    const P=document.getElementById('lchPanel'); const btn=P.querySelector('.lch-create'), bd=P.querySelector('.lch-pbody');
    const pr=P.getBoundingClientRect(); const ov=document.getElementById('landingOv');
    out[t+(fl===null?'':(fl?' con piso':' sin piso'))]={
      panel:Math.round(pr.height),
      botonDentro: btn?(Math.round(btn.getBoundingClientRect().bottom)<=Math.round(pr.bottom)):null,
      scrollDelCuerpo: bd?(bd.scrollHeight-bd.clientHeight):null,
      scrollDeLaPagina: ov.scrollHeight-ov.clientHeight }; } }
  return JSON.stringify(out,null,1); })()`));
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }
