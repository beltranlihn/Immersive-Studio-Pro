// [R189] A/B del export PNG: <video> (wcDecode:false) vs decodificador secuencial WebCodecs.
// Mide velocidad Y compara los PNG resultantes byte a byte — un máster distinto sería un fallo, no una mejora.
import { targets } from './cdp.mjs';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
const wait = ms => new Promise(r => setTimeout(r, ms));
const ROOT = 'C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro';
const PROJ = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\untitled.isp';
const BASE = 'C:\\Users\\beltr\\AppData\\Local\\Temp\\claude\\cdab';
const NF = Number(process.argv[2] || 12), NCLIPS = Number(process.argv[3] || 24), RES = Number(process.argv[4] || 4096);
for (const s of ['a', 'b']) { const p = path.join(BASE, s); fs.rmSync(p, { recursive: true, force: true }); fs.mkdirSync(p, { recursive: true }); }

const p = spawn(ROOT + '\\node_modules\\electron\\dist\\electron.exe', ['.', '--remote-debugging-port=9222'], { cwd: ROOT, stdio: 'ignore' });
let idx = null;
for (let i = 0; i < 250; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(200); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, pr) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: pr })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.exceptionThrown') errs.push(((x.params.exceptionDetails.exception || {}).description || '').slice(0, 160)); });
const evl = async e => { try { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 1800000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 300) }; return r.result.value; } catch (err) { return { CAIDA: String(err.message).slice(0, 140) }; } };
for (let i = 0; i < 150; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1500);

// El autoguardado "más reciente" (lo deja cada SIGKILL de estas pruebas) abre un confirm que cuelga el script → se responde "Abrir el archivo".
await evl(`window._autoCf=setInterval(()=>{const b=document.querySelector('#confirmOv #cfCancel'); if(b)b.click();},120), 1`);
console.log('proyecto:', await evl(`(async()=>{ const o=document.getElementById('landingOv'); if(o)o.remove();
  await openProjectPath('${PROJ}'); for(let i=0;i<80;i++){ if(state.media.length>2)break; await new Promise(r=>setTimeout(r,400)); }
  await new Promise(r=>setTimeout(r,5000)); const t=document.getElementById('tourOv'); if(t)t.remove();
  return JSON.stringify({seq:state.seqW+'x'+state.seqH+'@'+activeSeq().fps, clips:state.clips.length,
    medios:state.media.map(m=>m.kind+':'+(m.name||'')+(m.w?' '+m.w+'x'+m.h:'')) }); })()`));

// Se fabrica el peor caso real de Beltrán: NCLIPS clips DISTINTOS dentro del nest (tiempos locales escalonados
// → nada que agrupar, que es justo donde el arreglo de R188 no llega).
console.log('\nescenario:', await evl(`(async()=>{
  const vids=state.media.filter(m=>m.kind==='video'&&m.path);
  const nest=state.media.find(m=>m.kind==='nest'&&m.nestClips&&m.nestClips.some(c=>{const q=mediaById(c.mediaId);return q&&q.kind==='video';}));
  if(!nest)return 'sin nest con video';
  const semilla=nest.nestClips.find(c=>{const q=mediaById(c.mediaId);return q&&q.kind==='video';});
  const t0=semilla.t; const nuevos=[];
  for(let i=0;i<${NCLIPS};i++){ const m=vids[i%vids.length];
    const c=JSON.parse(JSON.stringify(semilla)); c.id=uid(); c.mediaId=m.id; c.lane=i;
    c.t=t0; c.dur=Math.min(m.dur||5,5); c.in=(i*0.37)%Math.max(0.1,(m.dur||5)-5.2); // tiempos locales todos distintos
    c.az=(i*15)%360; c.el=15+(i%4)*15; c.size=26;
    nuevos.push(c); }
  nest.nestClips=nuevos;
  const lanes=nest.nestLanes||state.lanes; while(lanes.length<${NCLIPS})lanes.push({name:'L'+lanes.length,mute:false,solo:false});
  if(typeof invalidateNest==='function')try{invalidateNest(nest);}catch(e){}
  const ext=clipExtent();
  return JSON.stringify({nest:nest.name, clipsEnNest:nest.nestClips.length, ext:[+ext[0].toFixed(2),+ext[1].toFixed(2)],
    localesDistintos:new Set(nuevos.map(c=>c.mediaId+'@'+c.in.toFixed(3))).size,
    lanes:(nest.nestLanes?nest.nestLanes.length:'usa state.lanes '+state.lanes.length)}); })()`));

const correr = (cd, dir) => `(async()=>{
  const curva=[]; const oSeek=seekExport;
  window.seekExport=async function(t){ const a=performance.now(); const r=await oSeek(t); curva.push(Math.round(performance.now()-a)); return r; };
  let ultimo=0, err=null, tP=0, avisos=[];
  const job={ prog:k=>{ if(k===1)tP=performance.now(); ultimo=k; }, label:()=>{}, frame:()=>{}, wrote:()=>{}, warn:w=>avisos.push(String(w)), done:()=>{}, fail:e=>{err=String(e&&e.message||e);} };
  const ext=clipExtent(); const a0=performance.now();
  try{ await runExport({codec:'png', res:${RES}, outW:${RES}, outH:${RES}, fps:60, bitrate:1e8, range:'clips',
    rangeT:[ext[0], ext[0]+${NF}/60], outDir:'${dir.replace(/\\/g, '\\\\')}', job, silent:true, noAudio:true, wcDecode:${cd}}); }catch(e){ err=String(e&&e.message||e); }
  const ms=performance.now()-a0; window.seekExport=oSeek;
  const arr=tP?(tP-a0):0;
  return JSON.stringify({fotogramas:ultimo, msArranque:Math.round(arr), msPorFotograma:(ultimo?Math.round((ms-arr)/ultimo):null),
    fps:(ultimo?+(ultimo/((ms-arr)/1000)).toFixed(2):null), seekCurva:curva, cdFail:state.media.filter(m=>m._cdFail).map(m=>m.name), avisos, err}); })()`;

console.log('\nA · <video> (como está hoy):', await evl(correr(false, path.join(BASE, 'a'))));
await wait(3000);
console.log('\nB · WebCodecs secuencial:  ', await evl(correr(true, path.join(BASE, 'b'))));

// ---- ¿es el MISMO máster? ----
const pngs = d => { const r = []; const walk = x => { for (const e of fs.readdirSync(x, { withFileTypes: true })) { const f = path.join(x, e.name); if (e.isDirectory()) walk(f); else if (/\.png$/i.test(e.name)) r.push(f); } }; walk(d); return r.sort(); };
const A = pngs(path.join(BASE, 'a')), B = pngs(path.join(BASE, 'b'));
const h = f => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');
let iguales = 0, distintos = [];
for (let i = 0; i < Math.min(A.length, B.length); i++) { if (h(A[i]) === h(B[i])) iguales++; else distintos.push(path.basename(A[i]) + ' ' + fs.statSync(A[i]).size + ' vs ' + fs.statSync(B[i]).size); }
console.log('\npng A=' + A.length + ' B=' + B.length + ' · identicos=' + iguales + (distintos.length ? ' · DISTINTOS: ' + distintos.slice(0, 6).join(' | ') : ''));
fs.writeFileSync(path.join(BASE, 'lista.json'), JSON.stringify({ A, B }));

console.log('\nerrores:', errs.length ? errs.slice(0, 6) : 'ninguno');
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }
