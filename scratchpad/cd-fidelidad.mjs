// [R189] ¿Entrega el decodificador secuencial EL MISMO máster que <video>?
// Se exporta 4 veces (A1,A2 por <video> · B1,B2 por WebCodecs) y se mide PSNR por fotograma:
//   A1↔A2 = ruido propio de <video> (línea base) · B1↔B2 = determinismo del camino nuevo · A1↔B1 = la comparación real.
import { targets } from './cdp.mjs';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
const wait = ms => new Promise(r => setTimeout(r, ms));
const ROOT = 'C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro';
const PROJ = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\untitled.isp';
const BASE = 'C:\\Users\\beltr\\AppData\\Local\\Temp\\claude\\cdfid';
const NF = Number(process.argv[2] || 10), NCLIPS = Number(process.argv[3] || 24), RES = Number(process.argv[4] || 2048);
fs.rmSync(BASE, { recursive: true, force: true });
const dirs = { a1: 0, a2: 0, b1: 0, b2: 0 };
for (const k of Object.keys(dirs)) { dirs[k] = path.join(BASE, k); fs.mkdirSync(dirs[k], { recursive: true }); }

const p = spawn(ROOT + '\\node_modules\\electron\\dist\\electron.exe', ['.', '--remote-debugging-port=9222'], { cwd: ROOT, stdio: 'ignore' });
let idx = null;
for (let i = 0; i < 250; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(200); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, pr) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: pr })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.exceptionThrown') errs.push(((x.params.exceptionDetails.exception || {}).description || '').slice(0, 180)); });
const evl = async e => { try { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 1800000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 300) }; return r.result.value; } catch (err) { return { CAIDA: String(err.message).slice(0, 140) }; } };
for (let i = 0; i < 150; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1200);
await evl(`window._autoCf=setInterval(()=>{const b=document.querySelector('#confirmOv #cfCancel'); if(b)b.click();},120), 1`);
await evl(`(async()=>{ const o=document.getElementById('landingOv'); if(o)o.remove(); await openProjectPath('${PROJ}');
  for(let i=0;i<80;i++){ if(state.media.length>2)break; await new Promise(r=>setTimeout(r,400)); } await new Promise(r=>setTimeout(r,4500));
  const t=document.getElementById('tourOv'); if(t)t.remove(); return 1; })()`);

console.log('escenario:', await evl(`(async()=>{
  const vids=state.media.filter(m=>m.kind==='video'&&m.path);
  const nest=state.media.find(m=>m.kind==='nest'&&m.nestClips&&m.nestClips.some(c=>{const q=mediaById(c.mediaId);return q&&q.kind==='video';}));
  const semilla=nest.nestClips.find(c=>{const q=mediaById(c.mediaId);return q&&q.kind==='video';});
  const nuevos=[];
  for(let i=0;i<${NCLIPS};i++){ const m=vids[i%vids.length];
    const c=JSON.parse(JSON.stringify(semilla)); c.id=uid(); c.mediaId=m.id; c.lane=i;
    c.t=semilla.t; c.dur=Math.min(m.dur||5,5); c.in=(i*0.37)%Math.max(0.1,(m.dur||5)-5.2);
    c.az=(i*15)%360; c.el=15+(i%4)*15; c.size=26; nuevos.push(c); }
  nest.nestClips=nuevos; const lanes=nest.nestLanes||state.lanes; while(lanes.length<${NCLIPS})lanes.push({name:'L'+lanes.length,mute:false,solo:false});
  return JSON.stringify({clips:nuevos.length, localesDistintos:new Set(nuevos.map(c=>c.mediaId+'@'+c.in.toFixed(3))).size}); })()`));

const correr = (cd, dir) => `(async()=>{
  let ultimo=0, err=null, tP=0;
  const job={ prog:k=>{ if(k===1)tP=performance.now(); ultimo=k; }, label:()=>{}, frame:()=>{}, wrote:()=>{}, warn:()=>{}, done:()=>{}, fail:e=>{err=String(e&&e.message||e);} };
  const ext=clipExtent(); const a0=performance.now();
  try{ await runExport({codec:'png', res:${RES}, outW:${RES}, outH:${RES}, fps:60, bitrate:1e8, range:'clips',
    rangeT:[ext[0], ext[0]+${NF}/60], outDir:'${dir.replace(/\\/g, '\\\\')}', job, silent:true, noAudio:true, wcDecode:${cd}}); }catch(e){ err=String(e&&e.message||e); }
  const ms=performance.now()-a0, arr=tP?(tP-a0):0;
  return JSON.stringify({fotogramas:ultimo, msPorFotograma:(ultimo?Math.round((ms-arr)/ultimo):null),
    fps:(ultimo?+(ultimo/((ms-arr)/1000)).toFixed(2):null), cdFail:state.media.filter(m=>m._cdFail).map(m=>m.name), err}); })()`;

for (const [k, cd] of [['a1', false], ['b1', true], ['a2', false], ['b2', true]]) {
  console.log(' ' + k + ':', await evl(correr(cd, dirs[k]))); await wait(2500);
}

// PSNR dentro de la app (decodifica los PNG con el propio navegador).
const pngs = d => { const r = []; const walk = x => { for (const e of fs.readdirSync(x, { withFileTypes: true })) { const f = path.join(x, e.name); if (e.isDirectory()) walk(f); else if (/\.png$/i.test(e.name)) r.push(f); } }; walk(d); return r.sort(); };
const L = {}; for (const k of Object.keys(dirs)) L[k] = pngs(dirs[k]);
const u = f => 'file:///' + f.replace(/\\/g, '/').replace(/ /g, '%20');
const psnr = async (f1, f2) => evl(`(async()=>{
  const car=async(u)=>{ const im=new Image(); im.src=u; await im.decode(); return im; };
  const A=await car('${u(f1)}'), B=await car('${u(f2)}');
  const W=A.naturalWidth,H=A.naturalHeight; if(B.naturalWidth!==W||B.naturalHeight!==H)return 'tamano distinto';
  const c=new OffscreenCanvas(W,H), g=c.getContext('2d',{willReadFrequently:true});
  g.drawImage(A,0,0); const da=g.getImageData(0,0,W,H).data;
  g.clearRect(0,0,W,H); g.drawImage(B,0,0); const db=g.getImageData(0,0,W,H).data;
  let se=0,n=0,maxd=0; for(let i=0;i<da.length;i+=4){ for(let k=0;k<3;k++){ const d=da[i+k]-db[i+k]; se+=d*d; n++; if(Math.abs(d)>maxd)maxd=Math.abs(d); } }
  const mse=se/n; return JSON.stringify({psnr:mse===0?'INFINITO (identico)':+(10*Math.log10(255*255/mse)).toFixed(2), maxDif:maxd}); })()`);

for (const [x, y, eti] of [['a1', 'a2', 'A1↔A2  (ruido propio de <video>)'], ['b1', 'b2', 'B1↔B2  (determinismo WebCodecs)'], ['a1', 'b1', 'A1↔B1  (¿mismo master?)']]) {
  const out = [];
  for (let i = 0; i < Math.min(L[x].length, L[y].length); i++) out.push(await psnr(L[x][i], L[y][i]));
  console.log('\n' + eti + ':'); out.forEach((r, i) => console.log('   f' + (i + 1) + ' ' + r));
}
console.log('\nerrores:', errs.length ? errs.slice(0, 6) : 'ninguno');
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }
