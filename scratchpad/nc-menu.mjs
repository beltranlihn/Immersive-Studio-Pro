// [R192] ¿Vuelven las entradas de menú, y sólo en composiciones cuadradas?
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
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.exceptionThrown') errs.push(((x.params.exceptionDetails.exception || {}).description || '').slice(0, 200)); });
const evl = async e => { try { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 600000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 300) }; return r.result.value; } catch (err) { return { CAIDA: String(err.message).slice(0, 140) }; } };
for (let i = 0; i < 150; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1200);
await evl(`window._autoCf=setInterval(()=>{const b=document.querySelector('#confirmOv #cfCancel'); if(b)b.click();},120), 1`);
await evl(`(async()=>{ const o=document.getElementById('landingOv'); if(o)o.remove(); await openProjectPath('${PROJ}');
  for(let i=0;i<80;i++){ if(state.media.length>2)break; await new Promise(r=>setTimeout(r,400)); } await new Promise(r=>setTimeout(r,4500));
  const t=document.getElementById('tourOv'); if(t)t.remove(); clearInterval(window._autoCf); return 1; })()`);

const menu = `(()=>{ const it=[...document.querySelectorAll('.menu .mi, .ctxmenu div, .menu div')].map(x=>x.textContent.trim()).filter(Boolean);
  return it.filter(t=>/proxy de composici|nest proxy|proxy est/i.test(t)); })()`;

console.log('nest CUADRADO · clic-derecho en el panel Media:', await evl(`(()=>{
  const m=state.media.filter(x=>x.kind==='nest'&&x.w===x.h).pop(); if(!m)return 'no hay nest cuadrado';
  openMediaCtx({preventDefault(){},clientX:200,clientY:200},m);
  const r=${menu}; document.querySelectorAll('.menu').forEach(x=>x.remove());
  return JSON.stringify({nest:m.name+' '+m.w+'x'+m.h, entradas:r}); })()`));

console.log('\nnest 16:9 (se le cambia el lienzo a mano) · mismo menu:', await evl(`(()=>{
  const m=state.media.filter(x=>x.kind==='nest'&&x.w===x.h).pop(); m.w=1920; m.h=1080;
  openMediaCtx({preventDefault(){},clientX:200,clientY:200},m);
  const r=${menu}; document.querySelectorAll('.menu').forEach(x=>x.remove());
  return JSON.stringify({nest:m.name+' 1920x1080', entradas:r, veredicto:r.length?'SE OFRECE — MAL':'no se ofrece, correcto'}); })()`));

console.log('\n¿ncBuild rechaza el no cuadrado aunque se le llame directo?', await evl(`(async()=>{
  const m=state.media.find(x=>x.kind==='nest'); let msg=null;
  window.appAlert=(t)=>{msg=t;};
  await ncBuild(m);
  const hay=!!(m.ncPath); m.w=4096; m.h=4096;
  return JSON.stringify({aviso:msg, seHorneo:hay}); })()`));

console.log('\nerrores:', errs.length ? errs.slice(0, 6) : 'ninguno');
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }
