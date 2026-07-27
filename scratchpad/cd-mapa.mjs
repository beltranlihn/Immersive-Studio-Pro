// Verdad medida: ¿a qué pts salta <video> para cada instante pedido?
// Truco: antes de cada medición se salta a un instante LEJANO, así el fotograma siempre cambia y
// requestVideoFrameCallback dispara de verdad (si no, un salto al mismo fotograma no notifica nada).
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
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.exceptionThrown') errs.push(((x.params.exceptionDetails.exception || {}).description || '').slice(0, 180)); });
const evl = async e => { try { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 900000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 300) }; return r.result.value; } catch (err) { return { CAIDA: String(err.message).slice(0, 140) }; } };
for (let i = 0; i < 150; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1200);
await evl(`window._autoCf=setInterval(()=>{const b=document.querySelector('#confirmOv #cfCancel'); if(b)b.click();},120), 1`);
await evl(`(async()=>{ const o=document.getElementById('landingOv'); if(o)o.remove(); await openProjectPath('${PROJ}');
  for(let i=0;i<80;i++){ if(state.media.length>2)break; await new Promise(r=>setTimeout(r,400)); } await new Promise(r=>setTimeout(r,4500));
  const t=document.getElementById('tourOv'); if(t)t.remove(); return 1; })()`);

console.log(await evl(`(async()=>{
  const m=state.media.find(x=>x.kind==='video'&&x.path);
  const d=await demuxMP4(m.path); const pts=d.samples.map(s=>s.pts).sort((a,b)=>a-b);
  const v=document.createElement('video'); v.muted=true; v.preload='auto'; v.src=m.srcUrl;
  await new Promise(r=>{ const on=()=>{v.removeEventListener('loadeddata',on);r();}; v.addEventListener('loadeddata',on); v.load(); });
  const saltar=(t)=>new Promise(res=>{ let hecho=false;
    const cb=(now,md)=>{ if(hecho)return; hecho=true; res(md.mediaTime); };
    v.requestVideoFrameCallback(cb);
    v.currentTime=t; setTimeout(()=>{ if(!hecho){hecho=true;res(null);} },2500); });
  const filas=[];
  for(let k=0;k<10;k++){ const t=k/60;
    await saltar(3.0);                       // lejos → el siguiente salto SIEMPRE cambia de fotograma
    const mt=await saltar(t);
    filas.push({k, pedido_us:+(t*1e6).toFixed(2), video_pts:(mt==null?'sin dato':Math.round(mt*1e6)),
      indiceVideo:(mt==null?null:pts.indexOf(Math.round(mt*1e6)))}); }
  d.close(); try{v.removeAttribute('src');v.load();}catch(e){}
  return JSON.stringify({primerosPts:pts.slice(0,10), filas},null,1); })()`));

console.log('\nerrores:', errs.length ? errs.slice(0, 6) : 'ninguno');
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }
