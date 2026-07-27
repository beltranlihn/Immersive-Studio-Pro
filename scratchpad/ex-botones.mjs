// [R190] Verifica los tres arreglos del panel de export en la app real.
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

const leer = `(()=>{ const g=document.getElementById('exGo'), c=document.getElementById('exClose');
  return JSON.stringify({ fase:document.getElementById('exChip').textContent,
    exportar:{texto:document.getElementById('exGoTxt').textContent, bloqueado:g.disabled, punteros:g.style.pointerEvents||'(normal)'},
    cerrar:c.textContent }); })()`;

console.log('1 · en reposo:      ', await evl(`(()=>{ openExport(); return ${leer}; })()`));

console.log('2 · durante render: ', await evl(`(async()=>{
  document.getElementById('exGo').click(); await new Promise(r=>setTimeout(r,2500)); return ${leer}; })()`));

console.log('   ¿un clic en Exportar relanza?', await evl(`(async()=>{
  const antes=_exJobs.length; document.getElementById('exGo').click(); await new Promise(r=>setTimeout(r,400));
  return _exJobs.length===antes?'NO (correcto)':'SI — RELANZO'; })()`));

console.log('3 · Cerrar con render vivo:', await evl(`(async()=>{
  document.getElementById('exClose').click(); await new Promise(r=>setTimeout(r,2500));
  return JSON.stringify({ panelEnPantalla:!!document.getElementById('exOv'), cancelExport, exportando:exporting, colaPendiente:_exq.length }); })()`));

console.log('4 · dialogo de preajuste por ENCIMA del panel:', await evl(`(async()=>{
  openExport(); await new Promise(r=>setTimeout(r,500));
  document.getElementById('exSavePreset').click(); await new Promise(r=>setTimeout(r,500));
  const ov=document.querySelector('.overlay'); const sh=document.getElementById('exOv');
  if(!ov)return 'no se abrio ningun dialogo';
  const zo=getComputedStyle(ov).zIndex, zs=getComputedStyle(sh).zIndex;
  // ¿es el diálogo quien recibe el clic en su propio centro?
  const r=ov.getBoundingClientRect(); const caja=ov.querySelector('.modal')||ov;
  const rc=caja.getBoundingClientRect();
  const arriba=document.elementFromPoint(Math.round(rc.left+rc.width/2), Math.round(rc.top+18));
  const dentro=!!(arriba&&ov.contains(arriba));
  const esc=new KeyboardEvent('keydown',{key:'Escape',bubbles:true}); document.dispatchEvent(esc);
  return JSON.stringify({zDialogo:zo, zPanelExport:zs, elClicLlegaAlDialogo:dentro, elemento:arriba?arriba.className||arriba.tagName:null}); })()`));

console.log('\nerrores:', errs.length ? errs.slice(0, 8) : 'ninguno');
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }
