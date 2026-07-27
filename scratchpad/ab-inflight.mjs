// ¿Cuánto solapamiento de compresión PNG conviene? Se mide 1 (en serie), 2 y 3 sobre el proyecto real.
import { targets } from './cdp.mjs';
import { spawn } from 'child_process';
const wait = ms => new Promise(r => setTimeout(r, ms));
const ROOT = 'C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro';
const PROJ = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\untitled.isp';
const OUT = 'C:\\\\Users\\\\beltr\\\\AppData\\\\Local\\\\Temp\\\\claude\\\\ab';

const p = spawn(ROOT + '\\node_modules\\electron\\dist\\electron.exe', ['.', '--remote-debugging-port=9222'], { cwd: ROOT, stdio: 'ignore' });
let idx = null;
for (let i = 0; i < 250; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(200); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, pr) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: pr })); });
await send('Runtime.enable', {});
const evl = async e => { try { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 600000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 200) }; return r.result.value; } catch (err) { return { CAIDA: String(err.message).slice(0, 100) }; } };
for (let i = 0; i < 150; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1500);

console.log('proyecto:', await evl(`(async()=>{ const o=document.getElementById('landingOv'); if(o)o.remove();
  await openProjectPath('${PROJ}'); for(let i=0;i<80;i++){ if(state.media.length>2)break; await new Promise(r=>setTimeout(r,400)); }
  await new Promise(r=>setTimeout(r,5000)); const t=document.getElementById('tourOv'); if(t)t.remove();
  await DSP.ensureDir('${OUT}'); return JSON.stringify({seq:state.seqW+'x'+state.seqH}); })()`));

for (const n of [1, 2, 3]) {
  const r = await evl(`(async()=>{ EX_PNG_INFLIGHT=${n};
    const curva=[]; const oSeek=seekExport;
    window.seekExport=async function(t){ const a=performance.now(); const r=await oSeek(t); curva.push(Math.round(performance.now()-a)); return r; };
    let ultimo=0,err=null,tP=0;
    const job={ prog:k=>{ if(k===1)tP=performance.now(); ultimo=k; }, label:()=>{}, frame:()=>{}, wrote:()=>{}, done:()=>{}, fail:e=>{err=String(e&&e.message||e);} };
    const ext=clipExtent(); const a0=performance.now();
    try{ await runExport({codec:'png',res:4096,outW:4096,outH:4096,fps:60,bitrate:1e8,range:'clips',
      rangeT:[ext[0],ext[0]+24/60], outDir:'${OUT}', job, silent:true, noAudio:true}); }catch(e){ err=String(e&&e.message||e); }
    const ms=performance.now()-a0; window.seekExport=oSeek;
    const u6=curva.slice(-6);
    return JSON.stringify({ msPorFotograma:Math.round((ms-(tP-a0))/Math.max(1,ultimo)),
      fps:+(ultimo/((ms-(tP-a0))/1000)).toFixed(2),
      seekPrimeros3:curva.slice(0,3), seekUltimos6:u6,
      seekFinal:Math.round(u6.reduce((x,y)=>x+y,0)/u6.length), err }); })()`);
  console.log('  en vuelo = ' + n + ':', r);
  await wait(2500);
}
try { ws.close(); } catch (_) {} try { p.kill('SIGKILL'); } catch (_) {}
