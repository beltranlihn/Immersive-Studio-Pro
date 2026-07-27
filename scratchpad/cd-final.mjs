// Comprobación final: el proyecto real SIN tocar, export PNG 4096 completo, y el editor sano después.
import { targets } from './cdp.mjs';
import { spawn } from 'child_process';
import fs from 'fs';
const wait = ms => new Promise(r => setTimeout(r, ms));
const ROOT = 'C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro';
const PROJ = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\untitled.isp';
const OUT = 'C:\\Users\\beltr\\AppData\\Local\\Temp\\claude\\cdfinal';
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const p = spawn(ROOT + '\\node_modules\\electron\\dist\\electron.exe', ['.', '--remote-debugging-port=9222'], { cwd: ROOT, stdio: 'ignore' });
let idx = null;
for (let i = 0; i < 250; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(200); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, pr) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: pr })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.exceptionThrown') errs.push(((x.params.exceptionDetails.exception || {}).description || '').slice(0, 200)); });
const evl = async e => { try { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 1800000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 300) }; return r.result.value; } catch (err) { return { CAIDA: String(err.message).slice(0, 140) }; } };
for (let i = 0; i < 150; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1200);
await evl(`window._autoCf=setInterval(()=>{const b=document.querySelector('#confirmOv #cfCancel'); if(b)b.click();},120), 1`);
console.log('proyecto:', await evl(`(async()=>{ const o=document.getElementById('landingOv'); if(o)o.remove();
  await openProjectPath('${PROJ}'); for(let i=0;i<80;i++){ if(state.media.length>2)break; await new Promise(r=>setTimeout(r,400)); }
  await new Promise(r=>setTimeout(r,5000)); const t=document.getElementById('tourOv'); if(t)t.remove();
  return JSON.stringify({seq:state.seqW+'x'+state.seqH+'@'+activeSeq().fps, dur:+clipExtent()[1].toFixed(2)}); })()`));

const brillo = `(async()=>{ state.t=0.3; try{ await scrubRender(); }catch(e){ return 'scrubRender roto: '+(e&&e.message||e); }
  await new Promise(r=>setTimeout(r,1200));
  const c=document.createElement('canvas'); c.width=64; c.height=64; const g2=c.getContext('2d');
  g2.drawImage(glc,0,0,64,64); const d=g2.getImageData(0,0,64,64).data;
  let s=0,mx=0; for(let i=0;i<d.length;i+=4){ s+=d[i]+d[i+1]+d[i+2]; mx=Math.max(mx,d[i],d[i+1],d[i+2]); }
  return JSON.stringify({brilloMedio:+(s/(64*64*3)).toFixed(1), brilloMaximo:mx}); })()`;
console.log('\nvisor ANTES del export:', await evl(brillo));

console.log('\nexport COMPLETO png 4096 (sin tocar nada):', await evl(`(async()=>{
  let ultimo=0, err=null, tP=0, avisos=[];
  const job={ prog:k=>{ if(k===1)tP=performance.now(); ultimo=k; }, label:()=>{}, frame:()=>{}, wrote:()=>{}, warn:w=>avisos.push(String(w)), done:()=>{}, fail:e=>{err=String(e&&e.message||e);} };
  const a0=performance.now();
  try{ await runExport({codec:'png', res:4096, outW:4096, outH:4096, fps:60, bitrate:1e8, range:'clips',
    outDir:'${OUT.replace(/\\/g, '\\\\')}', job, silent:true, noAudio:true}); }catch(e){ err=String(e&&e.message||e); }
  const ms=performance.now()-a0, arr=tP?(tP-a0):0;
  return JSON.stringify({fotogramas:ultimo, segundosTotal:+(ms/1000).toFixed(1), msPorFotograma:(ultimo?Math.round((ms-arr)/ultimo):null),
    fps:(ultimo?+(ultimo/((ms-arr)/1000)).toFixed(2):null), cdFail:state.media.filter(m=>m._cdFail).map(m=>m.name), avisos, err}); })()`));

console.log('\neditor sano tras el export:', await evl(`(async()=>{
  state.t=0.3; try{ await scrubRender(); }catch(e){ return 'scrubRender roto: '+(e&&e.message||e); }
  await new Promise(r=>setTimeout(r,1200));
  // ¿el visor pinta algo o quedó negro? se mide el brillo medio de una rejilla del lienzo
  const c=document.createElement('canvas'); c.width=64; c.height=64; const g2=c.getContext('2d');
  g2.drawImage(glc,0,0,64,64); const d=g2.getImageData(0,0,64,64).data;
  let s=0; for(let i=0;i<d.length;i+=4)s+=d[i]+d[i+1]+d[i+2];
  return JSON.stringify({_exCD, _exportQuality, exporting, lienzo:glc.width+'x'+glc.height,
    vinstVivos:_vinst.size, decodificadoresWebCodecs:[..._vinst.values()].filter(v=>v.cd).length,
    brilloMedioVisor:+(s/(64*64*3)).toFixed(1), mascaraRender:!!(document.getElementById('renderMask')||{}).classList&&document.getElementById('renderMask').classList.contains('on')}); })()`));

const n = fs.readdirSync(OUT, { recursive: true }).filter(f => /\.png$/i.test(f)).length;
console.log('\npng escritos:', n);
console.log('\nerrores:', errs.length ? errs.slice(0, 6) : 'ninguno');
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }
