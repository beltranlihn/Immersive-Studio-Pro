// [R199] Capturas del landing con 4, 3 y 2 muros, y con lados desiguales.
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
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 120000 }); return r.exceptionDetails ? JSON.stringify(r.exceptionDetails).slice(0, 400) : r.result.value; };
for (let i = 0; i < 150; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(2500);
mkdirSync(ROOT + '\\scratchpad\\shots', { recursive: true });
await evl(`(()=>{ if(!document.getElementById('landingOv'))showLanding(); _lch.ptype='room'; return 1; })()`);
const casos = [
  ['4muros', `lchSetWallCount(4)`],
  ['3muros', `lchSetWallCount(3)`],
  ['2muros', `lchSetWallCount(2)`],
  ['lados-desiguales', `lchSetWallCount(4); _lch.walls.find(w=>w.role==='Left').wcm=400; _lch.walls.find(w=>w.role==='Right').wcm=1200`],
];
for (const [n, js] of casos) {
  await evl(`(async()=>{ ${js}; renderLauncher(); await new Promise(r=>setTimeout(r,450)); lchPaintNow(); return 1; })()`);
  await wait(700);
  const s = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(ROOT + `\\scratchpad\\shots\\r199-${n}.png`, Buffer.from(s.data, 'base64'));
  console.log('shot', n, await evl(`JSON.stringify(lchActiveWalls().map(w=>w.role+' '+w.wcm))`));
}
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }
