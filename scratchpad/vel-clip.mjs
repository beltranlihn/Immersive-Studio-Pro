// [R195] Velocidad: ¿estira el clip, arrastra su automatización, y existe el campo editable?
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
const evl = async e => { try { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 300000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 300) }; return r.result.value; } catch (err) { return { CAIDA: String(err.message).slice(0, 140) }; } };
for (let i = 0; i < 150; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1200);
await evl(`window._autoCf=setInterval(()=>{const b=document.querySelector('#confirmOv #cfCancel'); if(b)b.click();},120), 1`);
await evl(`(async()=>{ const o=document.getElementById('landingOv'); if(o)o.remove(); await openProjectPath('${PROJ}');
  for(let i=0;i<80;i++){ if(state.media.length>2)break; await new Promise(r=>setTimeout(r,400)); } await new Promise(r=>setTimeout(r,4500));
  const t=document.getElementById('tourOv'); if(t)t.remove(); clearInterval(window._autoCf); return 1; })()`);

console.log('campo de velocidad en el inspector:', await evl(`(()=>{
  const c=state.clips[0]; state.selId=c.id; state.selIds=[c.id]; renderInspector();
  const f=document.querySelector('#playbackRows #spFld');
  if(!f)return 'NO EXISTE el campo';
  return JSON.stringify({ hayBarra:!!f.querySelector('.track>i'), numero:f.querySelector('.num').textContent,
    unidad:f.querySelector('.u').textContent, rangoViejo:!!document.getElementById('spRange') }); })()`));

console.log('\n2× velocidad → mitad de largo, keyframes a la mitad:', await evl(`(()=>{
  const c=state.clips[0]; c.speed=undefined; c.dur=8; c.fadeIn=1; c.fadeOut=1;
  c.kf={size:[{t:0,v:10},{t:4,v:50},{t:8,v:10}]};
  const antes={dur:c.dur, kf:c.kf.size.map(k=>k.t), fadeIn:c.fadeIn};
  setClipSpeed(c,200);
  return JSON.stringify({antes, despues:{velocidad:c.speed, dur:+c.dur.toFixed(3), kf:c.kf.size.map(k=>+k.t.toFixed(3)), fadeIn:c.fadeIn},
    veredicto:(Math.abs(c.dur-4)<1e-6 && Math.abs(c.kf.size[1].t-2)<1e-6 && Math.abs(c.kf.size[2].t-4)<1e-6)?'correcto':'MAL'}); })()`));

console.log('\nvolver a 100% → se recupera el largo original:', await evl(`(()=>{
  const c=state.clips[0]; setClipSpeed(c,100);
  return JSON.stringify({velocidad:c.speed===undefined?'normal':c.speed, dur:+c.dur.toFixed(3), kf:c.kf.size.map(k=>+k.t.toFixed(3)),
    veredicto:(Math.abs(c.dur-8)<1e-6 && Math.abs(c.kf.size[1].t-4)<1e-6)?'correcto':'MAL'}); })()`));

console.log('\nmedia velocidad → doble de largo:', await evl(`(()=>{
  const c=state.clips[0]; setClipSpeed(c,50);
  return JSON.stringify({dur:+c.dur.toFixed(3), kf:c.kf.size.map(k=>+k.t.toFixed(3)),
    veredicto:(Math.abs(c.dur-16)<1e-6&&Math.abs(c.kf.size[1].t-8)<1e-6)?'correcto':'MAL'}); })()`));

console.log('\nun clip en BUCLE no se estira:', await evl(`(()=>{
  const c=state.clips[0]; setClipSpeed(c,100); c.loop=true; c.loopLen=2; c.dur=8;
  setClipSpeed(c,200); const d=c.dur; c.loop=false; setClipSpeed(c,100);
  return JSON.stringify({durTrasCambio:d, veredicto:(Math.abs(d-8)<1e-6)?'correcto (no se toca)':'MAL'}); })()`));

console.log('\nla X de secuencia:', await evl(`(()=>{ const x=document.querySelector('.seqtab .seqx');
  if(!x)return 'no hay pestañas'; const s=getComputedStyle(x); return JSON.stringify({fuente:s.fontSize, relleno:s.padding, alto:Math.round(x.getBoundingClientRect().height)}); })()`));

console.log('\nerrores:', errs.length ? errs.slice(0, 6) : 'ninguno');
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }
