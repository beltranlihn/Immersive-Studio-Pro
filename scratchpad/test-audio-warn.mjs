// Se fuerza un plazo agotado en la decodificacion de audio: ¿nombra el clip y lo deja escrito en el panel?
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 300; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.exceptionThrown') errs.push(((x.params.exceptionDetails.exception || {}).description || '').slice(0, 140)); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 300000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 250) }; return r.result.value; };
for (let i = 0; i < 120; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1300);

const SRC = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\Rito Movie\\\\Asset\\\\Creation\\\\Front1.mp4';
const OUT = 'C:\\\\Users\\\\beltr\\\\AppData\\\\Local\\\\Temp\\\\claude\\\\exp-warn';

console.log('montaje:', await evl(`(async()=>{
  const o=document.getElementById('landingOv'); if(o)o.remove(); const t=document.getElementById('tourOv'); if(t)t.remove();
  const as=activeSeq(); as.w=640;as.h=360;as.fps=30; state.seqW=640;state.seqH=360;state.seqMode='flat';state.fps=30;
  await DSP.ensureDir('${OUT}'); currentPath='${OUT}\\\\e.isp';
  const m=await addVideoFromPath('${SRC}','Front1'); if(!m)return'sin video';
  state.clips=[]; const c=makeClip(m,0,0); c.start=0;c.dur=1;c.inP=3; state.clips.push(c);
  state.workIn=null;state.workOut=null; renderTimeline(); render();
  window._origRun=runExport; window.runExport=function(x){ x.outPath='${OUT}\\\\out.mp4'; return window._origRun(x); };
  // se fuerza el plazo: exDeadline con 1ms para la etapa de audio -> el clip DEBE salir nombrado
  window._origDl=exDeadline; window.exDeadline=function(p,ms,tag){ return window._origDl(p, /audio|decode|fetch/.test(tag)?1:ms, tag); };
  return 'ok'; })()`));

await evl(`(()=>{ const o=document.getElementById('exOv'); if(o)o.remove(); openExport();
  const p=document.getElementById('exOv'); const s=p.querySelector('#exCodec'); s.value='mp4'; s.dispatchEvent(new Event('change'));
  const f=p.querySelector('#exFps'); f.value='30'; f.dispatchEvent(new Event('change')); return true; })()`);
for (let i = 0; i < 40; i++) { if (await evl(`(()=>{const b=document.getElementById('exGo');return !!b&&!b.disabled;})()`)) break; await wait(400); }
await evl(`(()=>{ document.getElementById('exGo').click(); return true; })()`);

for (let i = 0; i < 60; i++) { await wait(1500);
  const st = await evl(`(()=>JSON.stringify({exporting:exporting,pct:document.getElementById('exPct').textContent}))()`);
  if (/"exporting":false/.test(st)) break; }

console.log('\naviso en el panel:', await evl(`(()=>{ const w=document.getElementById('exWarn');
  return JSON.stringify({ visible:w.style.display!=='none', texto:(w.textContent||'').trim(),
    nombraElClip:/Front1/.test(w.textContent||''), esAmbar:getComputedStyle(w).color,
    sobreviveAlTerminado:document.getElementById('exChip').textContent }); })()`));
console.log('archivo:', await evl(`(async()=>{try{const s=await DSP.stat('${OUT}\\\\out.mp4');return 'MB '+(s.size/1e6).toFixed(2);}catch(e){return 'no existe';}})()`));

// un render nuevo debe limpiar el aviso viejo
await evl(`(()=>{ window.exDeadline=window._origDl; document.getElementById('exGo').click(); return true; })()`);
await wait(1500);
console.log('el aviso se limpia al relanzar:', await evl(`(()=>{const w=document.getElementById('exWarn');return JSON.stringify({visible:w.style.display!=='none',texto:w.textContent});})()`));
for (let i = 0; i < 60; i++) { await wait(1500); if (/"exporting":false/.test(await evl(`(()=>JSON.stringify({exporting:exporting}))()`))) break; }
console.log('sin forzar el plazo, no hay aviso:', await evl(`(()=>{const w=document.getElementById('exWarn');return JSON.stringify({visible:w.style.display!=='none',chip:document.getElementById('exChip').textContent});})()`));
await evl(`(()=>{ if(window._origRun)window.runExport=window._origRun; if(window._origDl)window.exDeadline=window._origDl; return true; })()`);
console.log('\nerrores:', errs.length ? errs.slice(0, 5) : 'ninguno');
ws.close();
