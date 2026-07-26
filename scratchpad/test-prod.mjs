// Revisión de producción: filtro de códecs, cableado de TODOS los caminos, y sala por muro de verdad.
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
  if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errs.push((x.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 150));
  if (x.method === 'Runtime.exceptionThrown') errs.push(((x.params.exceptionDetails.exception || {}).description || '').slice(0, 150)); });
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 300000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 260) }; return r.result.value; };
for (let i = 0; i < 120; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1300);

const SRC = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\Rito Movie\\\\Asset\\\\Creation\\\\Front1.mp4';
const OUT = 'C:\\\\Users\\\\beltr\\\\AppData\\\\Local\\\\Temp\\\\claude\\\\prod';

await evl(`(async()=>{ const o=document.getElementById('landingOv'); if(o)o.remove(); const t=document.getElementById('tourOv'); if(t)t.remove();
  await DSP.ensureDir('${OUT}'); currentPath='${OUT}\\\\p.isp';
  const m=await addVideoFromPath('${SRC}','Front1');
  state.clips=[]; const c=makeClip(m,0,0); c.start=0;c.dur=1;c.inP=3; state.clips.push(c);
  state.workIn=null;state.workOut=null; return true; })()`);

const seq = (mode, w, h) => evl(`(()=>{ const as=activeSeq(); as.w=${w};as.h=${h};as.mode='${mode}';as.fps=30;
  state.seqW=${w};state.seqH=${h};state.seqMode='${mode}';state.fps=30;
  if('${mode}'==='room'){ as.room={walls:[
      {role:'front',x0:0,x1:1920,pxW:1920,pxH:1080,wcm:800,hcm:450,order:0},
      {role:'right',x0:1920,x1:3840,pxW:1920,pxH:1080,wcm:800,hcm:450,order:1},
      {role:'back', x0:3840,x1:5760,pxW:1920,pxH:1080,wcm:800,hcm:450,order:2}], floorSeqId:null}; }
  const p=document.getElementById('exOv'); if(p)p.remove(); openExport(); return true; })()`);
const espera = async () => { for (let i = 0; i < 40; i++) { const n = await evl(`(()=>{const s=document.getElementById('exCodec');return s?s.options.length:0;})()`); if (n) return true; await wait(300); } return false; };

console.log('=== 1+3 · la lista sólo ofrece lo que funciona ===');
for (const [n, m, w, h] of [['1080p', 'flat', 1920, 1080], ['4K UHD', 'flat', 3840, 2160], ['domo 4K', 'dome', 4096, 4096], ['domo 8K', 'dome', 8192, 8192], ['sala 3 muros', 'room', 5760, 1080]]) {
  await seq(m, w, h); await espera(); await wait(600);
  console.log('  ' + n.padEnd(13), await evl(`(()=>{const s=document.getElementById('exCodec');
    return JSON.stringify({opciones:[...s.options].map(o=>o.value), elegido:s.value, hayHEVC:[...s.options].some(o=>o.value==='hevc')});})()`));
}

console.log('\n=== 4 · qué opciones llegan al motor en cada camino ===');
await evl(`(()=>{ window._caps=[]; window._origRun=runExport;
  window.runExport=function(o){ window._caps.push({codec:o.codec,outW:o.outW,outH:o.outH,fps:o.fps,range:o.range,
    chunks:o.chunks, wall:o.wall?o.wall.role+' '+o.wall.pxW+'x'+o.wall.pxH:null, seqId:o.seqId||null});
    if(o.job&&o.job.done)setTimeout(()=>o.job.done(false),10); return Promise.resolve(); };
  return true; })()`);
for (const [n, m, w, h, codec] of [['2D · PNG', 'flat', 1920, 1080, 'png'], ['2D · H.264', 'flat', 1920, 1080, 'mp4'],
                                    ['2D · HAP', 'flat', 1920, 1080, 'hap'], ['2D · HAP Q', 'flat', 1920, 1080, 'hapq'],
                                    ['2D · still', 'flat', 1920, 1080, 'still'], ['domo · PNG', 'dome', 4096, 4096, 'png']]) {
  await seq(m, w, h); await espera();
  await evl(`(()=>{ window._caps=[]; const s=document.getElementById('exCodec'); s.value='${codec}'; s.dispatchEvent(new Event('change')); return true; })()`);
  await wait(500); await evl(`(()=>{ document.getElementById('exGo').click(); return true; })()`); await wait(600);
  console.log('  ' + n.padEnd(12), await evl(`(()=>JSON.stringify(window._caps))()`));
}
await seq('room', 5760, 1080); await espera();
await evl(`(()=>{ window._caps=[]; document.querySelector('#exRoomMode button[data-rm="walls"]').click();
  const s=document.getElementById('exCodec'); s.value='png'; s.dispatchEvent(new Event('change')); return true; })()`);
await wait(500); await evl(`(()=>{ document.getElementById('exGo').click(); return true; })()`); await wait(800);
console.log('  sala/muro  ', await evl(`(()=>JSON.stringify(window._caps))()`));
await evl(`(()=>{ window.runExport=window._origRun; return true; })()`);

console.log('\n=== 2 · sala por muro REAL: ¿dice «Terminado» antes de tiempo? ===');
await evl(`(()=>{ const as=activeSeq(); as.w=1920;as.h=360;as.mode='room'; state.seqW=1920;state.seqH=360;state.seqMode='room';as.fps=30;state.fps=30;
  as.room={walls:[{role:'front',x0:0,x1:640,pxW:640,pxH:360,wcm:800,hcm:450,order:0},
                  {role:'right',x0:640,x1:1280,pxW:640,pxH:360,wcm:800,hcm:450,order:1},
                  {role:'back', x0:1280,x1:1920,pxW:640,pxH:360,wcm:800,hcm:450,order:2}],floorSeqId:null};
  let k=0; window._origRun=runExport; window.runExport=function(o){ o.outPath='${OUT}\\\\muro'+(k++)+'.mp4'; return window._origRun(o); };
  const p=document.getElementById('exOv'); if(p)p.remove(); openExport(); return true; })()`);
await espera();
await evl(`(()=>{ document.querySelector('#exRoomMode button[data-rm="walls"]').click();
  const s=document.getElementById('exCodec'); s.value='mp4'; s.dispatchEvent(new Event('change')); return true; })()`);
for (let i = 0; i < 40; i++) { if (await evl(`(()=>{const b=document.getElementById('exGo');return !!b&&!b.disabled;})()`)) break; await wait(400); }
await evl(`(()=>{ document.getElementById('exGo').click(); return true; })()`);
const vistos = [];
for (let i = 0; i < 80; i++) { await wait(1200);
  const s = await evl(`(()=>JSON.stringify({chip:document.getElementById('exChip').textContent,pct:document.getElementById('exPct').textContent,sub:(document.getElementById('exSub').textContent||'').slice(0,52),exporting:exporting,cola:_exq.length}))()`);
  vistos.push(JSON.parse(s));
  if (/"exporting":false/.test(s) && JSON.parse(s).cola === 0) break; }
vistos.filter((_, i) => i % 3 === 0).forEach(v => console.log('   ', JSON.stringify(v)));
const dijoTerminadoAntes = vistos.some((v, i) => v.chip === 'Done' && vistos.slice(i + 1).some(w => w.exporting === true));
console.log('\n  ¿anunció «Terminado» con trabajo pendiente?:', dijoTerminadoAntes ? 'SÍ — MAL' : 'no — correcto');
console.log('  final:', JSON.stringify(vistos[vistos.length - 1]));
console.log('  archivos:', await evl(`(async()=>{ const r=[]; for(const n of ['muro0','muro1','muro2']){ try{const s=await DSP.stat('${OUT}\\\\'+n+'.mp4'); r.push(n+' '+(s.size/1e6).toFixed(2)+'MB');}catch(e){r.push(n+' NO');} } return JSON.stringify(r); })()`));
await evl(`(()=>{ if(window._origRun)window.runExport=window._origRun; return true; })()`);
console.log('\nerrores:', errs.length ? errs.slice(0, 6) : 'ninguno');
ws.close();
