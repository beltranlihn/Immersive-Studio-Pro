// [R192] ¿Aparece la entrada de proxy de composición, y sólo en composiciones cuadradas?
import { targets } from './cdp.mjs';
import { spawn } from 'child_process';
const wait = ms => new Promise(r => setTimeout(r, ms));
const ROOT = 'C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro';
const PROJ = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\untitled.isp';
const p = spawn(ROOT + '\\node_modules\\electron\\dist\\electron.exe', ['.', '--remote-debugging-port=9222'], { cwd: ROOT, stdio: 'ignore' });
let idx = null;
for (let i = 0; i < 250; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(200); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, pr) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: pr })); });
await send('Runtime.enable', {});
const evl = async e => { try { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 300000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 300) }; return r.result.value; } catch (err) { return { CAIDA: String(err.message).slice(0, 140) }; } };
for (let i = 0; i < 150; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1200);
await evl(`window._autoCf=setInterval(()=>{const b=document.querySelector('#confirmOv #cfCancel'); if(b)b.click();},120), 1`);
await evl(`(async()=>{ const o=document.getElementById('landingOv'); if(o)o.remove(); await openProjectPath('${PROJ}');
  for(let i=0;i<80;i++){ if(state.media.length>2)break; await new Promise(r=>setTimeout(r,400)); } await new Promise(r=>setTimeout(r,4500));
  const t=document.getElementById('tourOv'); if(t)t.remove(); clearInterval(window._autoCf); return 1; })()`);

const dump = `(()=>{ const mm=document.querySelector('.menu'); if(!mm)return ['(no se abrio menu)'];
  return [...mm.querySelectorAll('*')].filter(x=>x.children.length===0).map(x=>x.textContent.trim()).filter(Boolean); })()`;

console.log('CUADRADO 4096²:', await evl(`(()=>{ const m=state.media.filter(x=>x.kind==='nest'&&x.w===x.h).pop();
  document.querySelectorAll('.menu').forEach(x=>x.remove()); openMediaCtx({preventDefault(){},clientX:200,clientY:200},m);
  const it=${dump}; document.querySelectorAll('.menu').forEach(x=>x.remove());
  return JSON.stringify({nest:m.name+' '+m.w+'x'+m.h, proxy:it.filter(t=>/proxy de composici|nest proxy/i.test(t)), totalEntradas:it.length}); })()`));

console.log('\nNO CUADRADO 1920x1080:', await evl(`(()=>{ const m=state.media.filter(x=>x.kind==='nest').pop(); m.w=1920; m.h=1080;
  document.querySelectorAll('.menu').forEach(x=>x.remove()); openMediaCtx({preventDefault(){},clientX:200,clientY:200},m);
  const it=${dump}; document.querySelectorAll('.menu').forEach(x=>x.remove());
  const r=it.filter(t=>/proxy de composici|nest proxy/i.test(t));
  return JSON.stringify({proxy:r, veredicto:r.length?'SE OFRECE — MAL':'no se ofrece, correcto'}); })()`));

try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }
