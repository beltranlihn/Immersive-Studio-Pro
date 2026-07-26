// R183 · Render REAL desde la hoja: ¿avanza el monitor por fotograma? ¿pausa, reanuda y cancela?
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 300; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data);
  if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errs.push((x.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 170));
  if (x.method === 'Runtime.exceptionThrown') errs.push('exc: ' + ((x.params.exceptionDetails.exception || {}).description || '').slice(0, 170)); });
const evl = async (e, t = 300000) => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: t }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 300) }; return r.result.value; };
for (let i = 0; i < 120; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1300);

const SRC = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\Rito Movie\\\\Asset\\\\Creation\\\\Front1.mp4';
const OUT = 'C:\\\\Users\\\\beltr\\\\AppData\\\\Local\\\\Temp\\\\claude\\\\exp-run';

// secuencia 2D pequeña y H.264, para que el render sea corto y con bytes reales a disco
console.log('montaje:', JSON.stringify(await evl(`(async()=>{
  const ov=document.getElementById('landingOv'); if(ov)ov.remove(); const t=document.getElementById('tourOv'); if(t)t.remove();
  const as=activeSeq(); as.w=1280; as.h=720; as.fps=30; state.fps=30; state.seqW=1280; state.seqH=720; state.seqMode='flat';
  await DSP.ensureDir('${OUT}'); currentPath='${OUT}\\\\e.isp';
  const m=await addVideoFromPath('${SRC}','Front1'); if(!m)return{error:'sin video'};
  state.clips=[]; const c=makeClip(m,0,0); c.start=0; c.dur=4; c.inP=3; state.clips.push(c);
  state.workIn=null; state.workOut=null; renderTimeline(); render();
  // DSP viene de contextBridge y esta CONGELADO: parchear DSP.saveFile no surte efecto y se abre el dialogo
  // nativo, que espera a una persona. Se intercepta runExport (global en un script clasico) para inyectar outPath.
  window._origRun=runExport; window.runExport=function(o){ o.outPath='${OUT}\\\\out.mp4'; return window._origRun(o); };
  return {seq:state.seqW+'x'+state.seqH, dur:4}; })()`), null, 1));

await evl(`(()=>{ if(document.getElementById('exOv'))document.getElementById('exOv').remove(); openExport(); return true; })()`);
await wait(700);
await evl(`(()=>{ const ov=document.getElementById('exOv'); const s=ov.querySelector('#exCodec'); s.value='mp4'; s.dispatchEvent(new Event('change')); return true; })()`);
await wait(500);
console.log('antes de lanzar:', await evl(`(()=>{const o=document.getElementById('exOv');return JSON.stringify({codec:o.querySelector('#exCodec').value,est:o.querySelector('#exEst').textContent.slice(0,50),chip:o.querySelector('#exChip').textContent});})()`));

let listo = false; // exValidate deshabilita el primario mientras sondea el codec
for (let i = 0; i < 40; i++) { listo = await evl(`(()=>{const b=document.getElementById('exGo');return !!b&&!b.disabled;})()`); if (listo) break; await wait(400); }
console.log('\n→ Export (boton habilitado: ' + listo + ')');
await evl(`(()=>{ document.getElementById('exOv').querySelector('#exGo').click(); return true; })()`);

const snap = () => evl(`(()=>{const o=document.getElementById('exOv'); if(!o)return null;
  const c=document.getElementById('exMon'); let luz=0;
  try{ const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; for(let i=0;i<d.length;i+=4)if((d[i]+d[i+1]+d[i+2])>24)luz++; }catch(e){}
  return { chip:o.querySelector('#exChip').textContent, pct:o.querySelector('#exPct').textContent,
    sub:(o.querySelector('#exSub').textContent||'').slice(0,44), elapsed:o.querySelector('#exElapsed').textContent,
    remain:o.querySelector('#exRemain').textContent, wrote:o.querySelector('#exWrote').textContent,
    tc:o.querySelector('#exTc').textContent, nota:(o.querySelector('#exNote').textContent||'').slice(0,42),
    rail:o.querySelector('#exRail').firstElementChild.style.width, monitorLuz:luz,
    acciones:o.querySelector('#exActs').style.display }; })()`);

const serie = [];
for (let i = 0; i < 14; i++) { await wait(900); const s = await snap(); if (!s) break; serie.push(s);
  if (i === 4) { await evl(`(()=>{document.getElementById('exOv').querySelector('#exPause').click();return true;})()`); console.log('   [pausa]'); }
  if (i === 7) { await evl(`(()=>{document.getElementById('exOv').querySelector('#exPause').click();return true;})()`); console.log('   [reanudar]'); }
}
serie.forEach((s, i) => console.log('  ' + String(i).padStart(2) + ' ' + JSON.stringify(s)));

// comprobaciones
const enPausa = serie.filter(s => s.chip === 'Paused' || s.chip === 'En pausa');
const pctPausa = [...new Set(enPausa.map(s => s.pct))];
const monitorCambia = new Set(serie.map(s => s.monitorLuz)).size > 2;
console.log('\nveredicto:', JSON.stringify({
  monitorAvanzaPorFotograma: monitorCambia,
  pausaCongelaElPorcentaje: enPausa.length >= 2 && pctPausa.length === 1,
  bytesReales: serie.some(s => s.wrote && s.wrote !== '—'),
  fpsYmbs: serie.some(s => /fps/.test(s.nota)),
  botonesSoloAlRenderizar: serie.some(s => s.acciones === 'flex')
}, null, 1));

await wait(3000);
console.log('\nfinal:', await evl(`(()=>{const o=document.getElementById('exOv'); if(!o)return 'cerrado';
  return JSON.stringify({chip:o.querySelector('#exChip').textContent, pct:o.querySelector('#exPct').textContent,
    sub:o.querySelector('#exSub').textContent, nota:o.querySelector('#exNote').textContent,
    primario:o.querySelector('#exGoTxt').textContent, acciones:o.querySelector('#exActs').style.display});})()`));
console.log('archivo:', await evl(`(async()=>{ try{const st=await DSP.stat('${OUT}\\\\out.mp4'); return JSON.stringify({MB:+(st.size/1e6).toFixed(2)});}catch(e){return 'no existe';} })()`));
await evl(`(()=>{ if(window._origRun)window.runExport=window._origRun; return true; })()`);
console.log('\nerrores:', errs.length ? errs.slice(0, 8) : 'ninguno');
ws.close();
