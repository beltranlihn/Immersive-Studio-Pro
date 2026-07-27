// [R191] ¿Qué ofrece la lista de códecs, con qué límites, y bloquea Exportar cuando no cabe?
import { targets } from './cdp.mjs';
import { spawn } from 'child_process';
const wait = ms => new Promise(r => setTimeout(r, ms));
const ROOT = 'C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro';
const PROJ = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\untitled.isp';
const p = spawn(ROOT + '\\node_modules\\electron\\dist\\electron.exe', ['.', '--remote-debugging-port=9222'], { cwd: ROOT, stdio: 'ignore' });
let idx = null;
for (let i = 0; i < 250; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(200); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, pr) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: pr })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.exceptionThrown') errs.push(((x.params.exceptionDetails.exception || {}).description || '').slice(0, 200)); });
const evl = async e => { try { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 600000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 300) }; return r.result.value; } catch (err) { return { CAIDA: String(err.message).slice(0, 140) }; } };
for (let i = 0; i < 150; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1200);
await evl(`window._autoCf=setInterval(()=>{const b=document.querySelector('#confirmOv #cfCancel'); if(b)b.click();},120), 1`);
await evl(`(async()=>{ const o=document.getElementById('landingOv'); if(o)o.remove(); await openProjectPath('${PROJ}');
  for(let i=0;i<80;i++){ if(state.media.length>2)break; await new Promise(r=>setTimeout(r,400)); } await new Promise(r=>setTimeout(r,4500));
  const t=document.getElementById('tourOv'); if(t)t.remove(); clearInterval(window._autoCf); return 1; })()`);

console.log('techos medidos preguntando al codificador (1:1 y 16:9, 60 fps, 120 Mbps):', await evl(`(async()=>{
  const r={};
  for(const k of ['h264','hevc']) for(const [n,ar] of [['1:1 (domo)',1],['16:9',16/9]]){
    const t=await exTopeCodec(k,ar,60,120e6); r[k+' '+n]=t?(t.w+' x '+t.h):'no disponible'; }
  return JSON.stringify(r,null,1); })()`));

const listar = `(()=>{ const s=document.getElementById('exCodec');
  return JSON.stringify({ opciones:[...s.options].map(o=>o.textContent), elegido:s.value,
    aviso:(document.getElementById('exCodecHintRow').style.display==='none')?null:document.getElementById('exCodecHint').textContent,
    exportarBloqueado:document.getElementById('exGo').disabled }); })()`;

console.log('\nA · domo 4096² (el tamaño de su secuencia):', await evl(`(async()=>{
  openExport(); await new Promise(r=>setTimeout(r,1800)); return ${listar}; })()`));

console.log('\nB · elijo H.265 a 4096²:', await evl(`(async()=>{
  const s=document.getElementById('exCodec'); s.value='hevc'; s.dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(r=>setTimeout(r,1800)); return ${listar}; })()`));

console.log('\nC · bajo a 1024² con H.265 puesto (tamaño personalizado):', await evl(`(async()=>{
  document.querySelector('#exSz [data-sz=custom]').click(); await new Promise(r=>setTimeout(r,500));
  const w=document.getElementById('exSzW'); if(!w)return 'no aparecio el control de ancho';
  w.value=1024; w.dispatchEvent(new Event('blur',{bubbles:true})); if(w.onblur)w.onblur();
  await new Promise(r=>setTimeout(r,2200));
  const s=document.getElementById('exCodec');
  return JSON.stringify({ tamano:document.getElementById('exEst').textContent,
    elegido:s.value, aviso:(document.getElementById('exCodecHintRow').style.display==='none')?null:document.getElementById('exCodecHint').textContent,
    exportarBloqueado:document.getElementById('exGo').disabled }); })()`));

console.log('\nD · subo a 2048² con H.265 puesto (debe volver a bloquear):', await evl(`(async()=>{
  const w=document.getElementById('exSzW'); w.value=2048; if(w.onblur)w.onblur();
  await new Promise(r=>setTimeout(r,2200));
  return JSON.stringify({ tamano:document.getElementById('exEst').textContent,
    exportarBloqueado:document.getElementById('exGo').disabled,
    aviso:(document.getElementById('exCodecHintRow').style.display==='none')?null:document.getElementById('exCodecHint').textContent }); })()`));

console.log('\nerrores:', errs.length ? errs.slice(0, 8) : 'ninguno');
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }
