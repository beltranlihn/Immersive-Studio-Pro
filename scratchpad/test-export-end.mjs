// Render corto HASTA EL FINAL: estado 'done', bytes escritos, archivo en disco. Y despues, cancelar.
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 300; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.exceptionThrown') errs.push(((x.params.exceptionDetails.exception || {}).description || '').slice(0, 150)); });
const evl = async (e, t = 300000) => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: t }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 300) }; return r.result.value; };
for (let i = 0; i < 120; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1300);

const SRC = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\Rito Movie\\\\Asset\\\\Creation\\\\Front1.mp4';
const OUT = 'C:\\\\Users\\\\beltr\\\\AppData\\\\Local\\\\Temp\\\\claude\\\\exp-end';

console.log('montaje 640x360 · 1s:', await evl(`(async()=>{
  const ov=document.getElementById('landingOv'); if(ov)ov.remove(); const t=document.getElementById('tourOv'); if(t)t.remove();
  const as=activeSeq(); as.w=640; as.h=360; as.fps=30; state.fps=30; state.seqW=640; state.seqH=360; state.seqMode='flat';
  await DSP.ensureDir('${OUT}'); currentPath='${OUT}\\\\e.isp';
  const m=await addVideoFromPath('${SRC}','Front1'); if(!m)return'sin video';
  state.clips=[]; const c=makeClip(m,0,0); c.start=0; c.dur=1; c.inP=3; state.clips.push(c);
  state.workIn=null; state.workOut=null; renderTimeline(); render();
  window._origRun=runExport; window.runExport=function(o){ o.outPath='${OUT}\\\\out.mp4'; return window._origRun(o); };
  return 'ok'; })()`, P => P));

const abrir = async codec => { await evl(`(()=>{ const o=document.getElementById('exOv'); if(o)o.remove(); openExport();
    const p=document.getElementById('exOv'); const s=p.querySelector('#exCodec'); s.value='${codec}'; s.dispatchEvent(new Event('change'));
    const f=p.querySelector('#exFps'); f.value='30'; f.dispatchEvent(new Event('change')); return true; })()`);
  for (let i = 0; i < 40; i++) { if (await evl(`(()=>{const b=document.getElementById('exGo');return !!b&&!b.disabled;})()`)) return true; await wait(400); }
  return false; };

console.log('panel listo:', await abrir('mp4'));
await evl(`(()=>{ document.getElementById('exGo').click(); return true; })()`);
for (let i = 0; i < 60; i++) { await wait(1500);
  const st = await evl(`(()=>JSON.stringify({chip:document.getElementById('exChip').textContent,pct:document.getElementById('exPct').textContent,exporting:exporting}))()`);
  if (i % 4 === 0) console.log('  ', st);
  if (/"exporting":false/.test(st)) break; }

console.log('\nal terminar:', await evl(`(()=>{const o=document.getElementById('exOv');
  return JSON.stringify({chip:o.querySelector('#exChip').textContent, fase:o.querySelector('#exPhase').textContent,
    pct:o.querySelector('#exPct').textContent, sub:o.querySelector('#exSub').textContent,
    escrito:o.querySelector('#exWrote').textContent, nota:o.querySelector('#exNote').textContent,
    primario:o.querySelector('#exGoTxt').textContent, acciones:o.querySelector('#exActs').style.display,
    rail:o.querySelector('#exRail').firstElementChild.style.width, railClase:o.querySelector('#exRail').className});})()`));
console.log('archivo:', await evl(`(async()=>{try{const s=await DSP.stat('${OUT}\\\\out.mp4');return 'MB '+(s.size/1e6).toFixed(2);}catch(e){return 'no existe';}})()`));
console.log('reproducible:', await evl(`(async()=>{ const v=document.createElement('video'); v.muted=true; v.src=DSP.toFileURL('${OUT}\\\\out.mp4');
  return await new Promise(r=>{let d=false;v.onloadedmetadata=()=>{if(!d){d=true;r(v.videoWidth+'x'+v.videoHeight+' · '+v.duration.toFixed(2)+'s');}};v.onerror=()=>{if(!d){d=true;r('no carga');}};setTimeout(()=>{if(!d){d=true;r('timeout');}},12000);}); })()`));

// --- cancelar a mitad
console.log('\n--- cancelar a mitad ---');
console.log('panel listo:', await abrir('mp4'));
await evl(`(()=>{ document.getElementById('exGo').click(); return true; })()`);
await wait(3500);
console.log('antes de cancelar:', await evl(`(()=>JSON.stringify({pct:document.getElementById('exPct').textContent,chip:document.getElementById('exChip').textContent}))()`));
await evl(`(()=>{ document.getElementById('exCancel').click(); return true; })()`);
for (let i = 0; i < 30; i++) { await wait(1200); if (/"exporting":false/.test(await evl(`(()=>JSON.stringify({exporting:exporting}))()`))) break; }
console.log('tras cancelar:', await evl(`(()=>{const o=document.getElementById('exOv');
  return JSON.stringify({chip:o.querySelector('#exChip').textContent, nota:o.querySelector('#exNote').textContent,
    acciones:o.querySelector('#exActs').style.display, primario:o.querySelector('#exGoTxt').textContent});})()`));

// --- Esc cierra
await evl(`(()=>{ document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return true; })()`);
await wait(400);
console.log('Esc cierra:', await evl(`(()=>!document.getElementById('exOv'))()`));
await evl(`(()=>{ if(window._origRun)window.runExport=window._origRun; return true; })()`);
console.log('\nerrores:', errs.length ? errs.slice(0, 6) : 'ninguno');
ws.close();
