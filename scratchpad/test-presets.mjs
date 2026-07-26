// ¿El preajuste recuerda el MODO de tamaño (igualar / preajuste / personalizado) y no sólo el ancho?
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
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 120000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 250) }; return r.result.value; };
for (let i = 0; i < 120; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1200);

await evl(`(async()=>{ const o=document.getElementById('landingOv'); if(o)o.remove(); const t=document.getElementById('tourOv'); if(t)t.remove();
  const as=activeSeq(); as.w=1920;as.h=1080;as.mode='flat';as.fps=30; state.seqW=1920;state.seqH=1080;state.seqMode='flat';state.fps=30;
  if(!state.clips.length){ const m={id:uid(),kind:'shape',name:'B',shape:'rect',fill:'#FFF',stroke:'#000',strokeW:0,sw:512,sh:512,dur:6,fps:0,color:clipColorFor('shape')};
    renderShapeMedia(m); state.media.push(m); const c=makeClip(m,0,0); c.start=0;c.dur=1; state.clips.push(c); }
  state.exportPresets=[]; return true; })()`);

const abrir = async () => { await evl(`(()=>{ const o=document.getElementById('exOv'); if(o)o.remove(); openExport(); return true; })()`);
  for (let i = 0; i < 40; i++) { if (await evl(`(()=>{const s=document.getElementById('exCodec');return s&&s.options.length>0;})()`)) return true; await wait(300); } return false; };

// guardar un preajuste PERSONALIZADO no cuadrado
await abrir();
console.log('guardar personalizado 2560×1072:', await evl(`(async()=>{
  document.querySelector('#exSz button[data-sz="custom"]').click(); await new Promise(r=>setTimeout(r,400));
  const w=document.getElementById('exSzW'), h=document.getElementById('exSzH');
  w.value='2560'; h.value='1072'; w.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  await new Promise(r=>setTimeout(r,500));
  window._origPrompt=appPrompt; window.appPrompt=(msg,def,cb)=>cb('Cine');
  document.getElementById('exSavePreset').click(); await new Promise(r=>setTimeout(r,400));
  window.appPrompt=window._origPrompt;
  return JSON.stringify(state.exportPresets); })()`));

// guardar uno de IGUALAR A LA FUENTE
console.log('\nguardar «igualar a la fuente»:', await evl(`(async()=>{
  document.querySelector('#exSz button[data-sz="match"]').click(); await new Promise(r=>setTimeout(r,500));
  window._origPrompt=appPrompt; window.appPrompt=(msg,def,cb)=>cb('Fuente');
  document.getElementById('exSavePreset').click(); await new Promise(r=>setTimeout(r,400));
  window.appPrompt=window._origPrompt;
  return JSON.stringify(state.exportPresets.map(p=>({n:p.name,szMode:p.szMode,res:p.res,szH:p.szH}))); })()`));

// reabrir y aplicarlos: ¿vuelve el modo correcto?
await abrir();
console.log('\naplicar «Cine» (personalizado):', await evl(`(async()=>{
  const ps=document.getElementById('exPreset'); ps.value='0'; ps.dispatchEvent(new Event('change'));
  await new Promise(r=>setTimeout(r,700));
  const on=[...document.querySelectorAll('#exSz button')].filter(b=>b.classList.contains('on')).map(b=>b.dataset.sz);
  return JSON.stringify({modoActivo:on, est:(document.getElementById('exEst').textContent||'').slice(0,44)}); })()`));

console.log('\naplicar «Fuente» (igualar):', await evl(`(async()=>{
  const ps=document.getElementById('exPreset'); ps.value='1'; ps.dispatchEvent(new Event('change'));
  await new Promise(r=>setTimeout(r,700));
  const on=[...document.querySelectorAll('#exSz button')].filter(b=>b.classList.contains('on')).map(b=>b.dataset.sz);
  return JSON.stringify({modoActivo:on, hint:(document.getElementById('exSzCtl').textContent||'').replace(/\\s+/g,' ').slice(0,48)}); })()`));

console.log('\nerrores:', errs.length ? errs.slice(0, 5) : 'ninguno');
ws.close();
