// Se cronometra el bucle REAL desde dentro, envolviendo seekExport y toBlob. Sin replicar nada.
import { targets } from './cdp.mjs';
import { spawn } from 'child_process';
const wait = ms => new Promise(r => setTimeout(r, ms));
const ROOT = 'C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro';
const PROJ = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\untitled.isp';
const OUT = 'C:\\\\Users\\\\beltr\\\\AppData\\\\Local\\\\Temp\\\\claude\\\\perfd';

const p = spawn(ROOT + '\\node_modules\\electron\\dist\\electron.exe', ['.', '--remote-debugging-port=9222'], { cwd: ROOT, stdio: 'ignore' });
let idx = null;
for (let i = 0; i < 250; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(200); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, pr) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: pr })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.exceptionThrown') errs.push(((x.params.exceptionDetails.exception || {}).description || '').slice(0, 130)); });
const evl = async e => { try { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 600000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 250) }; return r.result.value; } catch (err) { return { CAIDA: String(err.message).slice(0, 110) }; } };
for (let i = 0; i < 150; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1500);

console.log('proyecto:', await evl(`(async()=>{
  const o=document.getElementById('landingOv'); if(o)o.remove();
  await openProjectPath('${PROJ}');
  for(let i=0;i<80;i++){ if(state.media.length>2)break; await new Promise(r=>setTimeout(r,400)); }
  await new Promise(r=>setTimeout(r,5000));
  const t=document.getElementById('tourOv'); if(t)t.remove();
  await DSP.ensureDir('${OUT}');
  return JSON.stringify({seq:state.seqW+'x'+state.seqH, clips:state.clips.length}); })()`));

console.log('\nbucle real instrumentado (24 fotogramas):', await evl(`(async()=>{
  const T={seek:0,blob:0,write:0,otro:0}; let nSeek=0,nBlob=0,nWrite=0;
  const oSeek=seekExport, oBlob=glc.toBlob.bind(glc), oWrite=DSP.writeBinary;
  const curva=[];
  window.seekExport=async function(t){ const a=performance.now(); const r=await oSeek(t); const d=performance.now()-a; T.seek+=d; nSeek++; curva.push(Math.round(d)); return r; };
  glc.toBlob=function(cb,tipo,q){ const a=performance.now(); return oBlob(b=>{ T.blob+=performance.now()-a; nBlob++; cb(b); },tipo,q); };

  let ultimo=0, err=null, tPrimer=0;
  const job={ prog:(k)=>{ if(k===1)tPrimer=performance.now(); ultimo=k; }, label:()=>{}, frame:()=>{}, wrote:()=>{}, done:()=>{}, fail:e=>{err=String(e&&e.message||e);} };
  const ext=clipExtent(); const a0=performance.now();
  try{ await runExport({codec:'png', res:4096, outW:4096, outH:4096, fps:60, bitrate:1e8, range:'clips',
        rangeT:[ext[0], ext[0]+24/60], outDir:'${OUT}', job, silent:true, noAudio:true}); }catch(e){ err=String(e&&e.message||e); }
  const ms=performance.now()-a0;
  window.seekExport=oSeek; glc.toBlob=oBlob;
  const arr=tPrimer?(tPrimer-a0):0;
  return JSON.stringify({ fotogramas:ultimo, msTotal:Math.round(ms), arranque:Math.round(arr),
    msPorFotograma:(ultimo?Math.round((ms-arr)/ultimo):null),
    seek:{llamadas:nSeek, msMedia:nSeek?Math.round(T.seek/nSeek):null, pct:Math.round(T.seek/ms*100)+'%'},
    pngEncode:{llamadas:nBlob, msMedia:nBlob?Math.round(T.blob/nBlob):null, pct:Math.round(T.blob/ms*100)+'%'},
    curvaSeek:curva, seekSinLosTresPrimeros:(curva.length>3?Math.round(curva.slice(3).reduce((x,y)=>x+y,0)/(curva.length-3)):null),
    err },null,1); })()`));

console.log('\nerrores:', errs.length ? errs.slice(0, 5) : 'ninguno');
try { ws.close(); } catch (_) {} try { p.kill('SIGKILL'); } catch (_) {}
