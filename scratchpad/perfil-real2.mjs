// Coste de ARRANQUE (decodificar audio) vs coste POR FOTOGRAMA, separados. Proyecto real de Beltrán.
import { targets } from './cdp.mjs';
import { spawn } from 'child_process';
const wait = ms => new Promise(r => setTimeout(r, ms));
const ROOT = 'C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro';
const PROJ = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\untitled.isp';
const OUT = 'C:\\\\Users\\\\beltr\\\\AppData\\\\Local\\\\Temp\\\\claude\\\\perfout';

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
  const ext=clipExtent();
  return JSON.stringify({seq:state.seqW+'x'+state.seqH+'@'+activeSeq().fps, ext:[+ext[0].toFixed(2),+ext[1].toFixed(2)]}); })()`));

const correr = (noAudio, n) => `(async()=>{
  let ultimo=0, err=null, tPrimer=0;
  const job={ prog:(k)=>{ if(k===1)tPrimer=performance.now(); ultimo=k; }, label:()=>{}, frame:()=>{}, wrote:()=>{}, done:()=>{}, fail:e=>{err=String(e&&e.message||e);} };
  const ext=clipExtent(); const a=performance.now();
  try{ await runExport({codec:'png', res:4096, outW:4096, outH:4096, fps:60, bitrate:1e8, range:'clips',
        rangeT:[ext[0], ext[0]+${n}/60], outDir:'${OUT}', job, silent:true, noAudio:${noAudio}}); }catch(e){ err=String(e&&e.message||e); }
  const ms=performance.now()-a;
  const arr=tPrimer?(tPrimer-a):0;
  return JSON.stringify({fotogramas:ultimo, msTotal:Math.round(ms), arranque:Math.round(arr),
    msPorFotograma:(ultimo?Math.round((ms-arr)/ultimo):null), fps:(ultimo?+(ultimo/((ms-arr)/1000)).toFixed(2):null), err}); })()`;

console.log('\nSIN audio (coste puro por fotograma):', await evl(correr(true, 24)));
console.log('\nCON audio (arranque = decodificar los 2 vídeos):', await evl(correr(false, 24)));

console.log('\n¿escribe de verdad?:', await evl(`(async()=>{ try{
  const L=await DSP.listDir('${OUT}'); const nombres=(L||[]).map(f=>f.name||f); const det=[];
  for(const nm of nombres){ try{ const L2=await DSP.listDir('${OUT}\\\\'+nm);
    const pngs=(L2||[]).filter(f=>/\\.png$/i.test(f.name||f));
    if(pngs.length)det.push(nm+' → '+pngs.length+' png'); }catch(e){} }
  return JSON.stringify({entradas:nombres.slice(0,3), conPng:det}); }catch(e){ return 'err '+e.message; } })()`));

console.log('\nerrores:', errs.length ? errs.slice(0, 5) : 'ninguno');
try { ws.close(); } catch (_) {} try { p.kill('SIGKILL'); } catch (_) {}
