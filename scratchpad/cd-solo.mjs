// Un ClipDecoder aislado sobre el archivo real: ¿llega a entregar fotogramas, y en cuánto?
import { targets } from './cdp.mjs';
import { spawn } from 'child_process';
const wait = ms => new Promise(r => setTimeout(r, ms));
const ROOT = 'C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro';
const PROJ = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\untitled.isp';
const N = Number(process.argv[2] || 1);
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
  for(let i=0;i<80;i++){ if(state.media.length>2)break; await new Promise(r=>setTimeout(r,400)); } await new Promise(r=>setTimeout(r,4000));
  const t=document.getElementById('tourOv'); if(t)t.remove(); return 1; })()`);

console.log(`${N} decodificador(es) en paralelo, avance secuencial de 24 fotogramas:`, await evl(`(async()=>{
  const m=state.media.find(x=>x.kind==='video'&&x.path); if(!m)return 'sin video';
  const cds=[];
  for(let k=0;k<${N};k++){ const d=await demuxMP4(m.path); cds.push(makeClipDecoder(d,true)); }
  const c0=cds[0];
  const primero=await (async()=>{ const a=performance.now(); c0.setTarget(0);
    for(let i=0;i<4000;i++){ c0.pump(); if(c0.frameNear(0))return {ms:Math.round(performance.now()-a), stats:c0.stats()}; await new Promise(r=>setTimeout(r,1)); }
    return {ms:-1, stats:c0.stats()}; })();
  if(primero.ms<0){ for(const c of cds)c.close(); return JSON.stringify({primerFotograma:'NUNCA', stats:primero.stats}); }
  const fd=c0.frameDurUs; const tiempos=[];
  for(let i=1;i<=24;i++){ const t=i*Math.round(1e6/60); const a=performance.now();
    for(const c of cds)c.setTarget(t);
    let ok=false;
    for(let k=0;k<3000;k++){ for(const c of cds)c.pump();
      const f=c0.frameNear(t); if(f&&(Math.abs(t-f.timestamp)<=fd*1.5||c0.passed(t))){ ok=true; break; }
      await new Promise(r=>setTimeout(r,0)); }
    tiempos.push(ok?Math.round(performance.now()-a):-1); }
  const st=c0.stats(); for(const c of cds)c.close();
  return JSON.stringify({primerFotogramaMs:primero.ms, frameDurUs:fd, msPorFotograma:tiempos, stats:st}); })()`));

console.log('\nerrores:', errs.length ? errs.slice(0, 6) : 'ninguno');
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }
