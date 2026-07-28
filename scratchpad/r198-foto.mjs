// [R198] Captura del landing en los tres formatos, para mirarlo con los ojos y no sólo con números.
import { targets } from './cdp.mjs';
import { spawn } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
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
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 120000 }); return r.exceptionDetails ? JSON.stringify(r.exceptionDetails).slice(0, 300) : r.result.value; };
for (let i = 0; i < 150; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(2500);
mkdirSync(ROOT + '\\scratchpad\\shots', { recursive: true });
await evl(`(()=>{ if(!document.getElementById('landingOv'))showLanding(); return 1; })()`);
for (const t of ['room', 'dome', 'flat']) {
  await evl(`(async()=>{ _lch.ptype='${t}'; if('${t}'==='dome')_lch.domeCov=220; renderLauncher();
    await new Promise(r=>setTimeout(r,400)); lchPaintNow(); return 1; })()`);
  await wait(600);
  const s = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(ROOT + `\\scratchpad\\shots\\r198-${t}.png`, Buffer.from(s.data, 'base64'));
  console.log('shot', t);
}
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }
