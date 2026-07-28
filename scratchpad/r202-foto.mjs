// [R202] Captura del máster fisheye con el relleno de domo: sectores curvados vs baldosas planas.
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
await evl(`setInterval(()=>{const b=document.querySelector('#confirmOv #cfCancel'); if(b)b.click();},120);1`);
mkdirSync(ROOT + '\\scratchpad\\shots', { recursive: true });
// proyecto domo + una forma RECTANGULAR marcada (16:9) para que se vea si conserva su proporción
console.log('montaje:', await evl(`(async()=>{ try{ hideLanding(); }catch(e){}
  await newProject('dome',2048,2048,60,180);
  const m={id:uid(),kind:'shape',name:'T',shape:'rect',fill:'#C8A24A',stroke:'#101216',strokeW:14,sw:1600,sh:900,dur:8,fps:0,color:clipColorFor('shape')};
  renderShapeMedia(m); state.media.push(m); renderMedia();
  createComposition({kind:'domegrid',mediaIds:[m.id],mediaId:m.id,rings:3,segs:8,count:24,elMin:0,elMax:90,size:34,gapEl:0,gapAz:0,mask:'none',noWarp:false});
  state.view.mode='2d'; state.view.showGrid=false; resize(); render(); return 'ok'; })()`));
await wait(1200);
let s = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(ROOT + '\\scratchpad\\shots\\r202-sectores.png', Buffer.from(s.data, 'base64'));
console.log('shot sectores');
console.log('a baldosas:', await evl(`(()=>{ const n=state.media.filter(m=>isSeqMedia(m)&&m.comp).pop();
  n.comp.noWarp=true; regenComposeNest(n); render(); return !!n.comp.noWarp; })()`));
await wait(1200);
s = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(ROOT + '\\scratchpad\\shots\\r202-baldosas.png', Buffer.from(s.data, 'base64'));
console.log('shot baldosas');
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }
