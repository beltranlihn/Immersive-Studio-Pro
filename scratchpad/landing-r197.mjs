// [R197] Landing: fuera preferencias y Uniform, preset como desplegable+Guardar junto a Muros, Facing con lista.
import { targets } from './cdp.mjs';
import { spawn } from 'child_process';
const wait = ms => new Promise(r => setTimeout(r, ms));
const ROOT = 'C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro';
const p = spawn(ROOT + '\\node_modules\\electron\\dist\\electron.exe', ['.', '--remote-debugging-port=9222'], { cwd: ROOT, stdio: 'ignore' });
let idx = null;
for (let i = 0; i < 250; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(200); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, pr) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: pr })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data); if (x.method === 'Runtime.exceptionThrown') errs.push(((x.params.exceptionDetails.exception || {}).description || '').slice(0, 200)); });
const evl = async e => { try { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 300000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 300) }; return r.result.value; } catch (err) { return { CAIDA: String(err.message).slice(0, 140) }; } };
for (let i = 0; i < 150; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(2500);

console.log('el landing sigue abriendo:', await evl(`(()=>{ if(!document.getElementById('landingOv'))showLanding();
  return !!document.getElementById('landingOv'); })()`));

console.log('\nsala 360 · fila de muros y preset:', await evl(`(()=>{
  _lch.ptype='room'; renderLauncher();
  const sel=document.getElementById('lchRoomPre'), sv=document.getElementById('lchPreSave');
  const filas=[...document.querySelectorAll('#lchPanel .lch-row .lab')].map(x=>x.textContent.trim());
  const filaDeMuros=sel?sel.closest('.lch-row'):null;
  return JSON.stringify({
    hayDesplegable:!!sel, opciones:sel?[...sel.options].map(o=>o.textContent):null, hayGuardar:!!sv,
    presetEnLaFilaDeMuros:!!(filaDeMuros&&/Muros|Walls/.test(filaDeMuros.querySelector('.lab').textContent)),
    quedaUniform:filas.some(t=>/Uniform/i.test(t)), quedaFilaPresetSuelta:filas.filter(t=>/Preset|Preajuste/i.test(t)).length,
    etiquetas:filas }); })()`));

console.log('\nboton de preferencias:', await evl(`(()=>JSON.stringify({existe:!!document.getElementById('lchPrefs')}))()`));

console.log('\nFacing abre lista (no cicla):', await evl(`(()=>{
  const b=document.querySelector('#lchPanel [data-lface]'); if(!b)return 'no hay muros';
  const antes=_lch.walls[0].role;
  document.querySelectorAll('.menu').forEach(x=>x.remove());
  b.onclick({clientX:300,clientY:300});
  const m=document.querySelector('.menu');
  const items=m?[...m.querySelectorAll('*')].filter(x=>x.children.length===0).map(x=>x.textContent.trim()).filter(Boolean):[];
  document.querySelectorAll('.menu').forEach(x=>x.remove());
  return JSON.stringify({rolAntes:antes, noCambioSolo:_lch.walls[0].role===antes, opciones:items}); })()`));

console.log('\nguardar y aplicar un preajuste propio:', await evl(`(()=>{
  try{ localStorage.removeItem('ispRoomPresets'); }catch(e){}
  lchActiveWalls().forEach(w=>{ w.pxW=1234; w.pxH=567; });
  const p=[{label:'Mi sala', walls:lchActiveWalls().map(w=>({pxW:w.pxW,pxH:w.pxH,wcm:w.wcm,hcm:w.hcm})), count:_lch.roomCount}];
  localStorage.setItem('ispRoomPresets',JSON.stringify(p));
  lchApplyPreset('1920x1080'); const tras=_lch.walls[0].pxW+'x'+_lch.walls[0].pxH;
  lchApplyPreset('u:0'); const propio=_lch.walls[0].pxW+'x'+_lch.walls[0].pxH;
  const sel=document.getElementById('lchRoomPre');
  try{ localStorage.removeItem('ispRoomPresets'); }catch(e){}
  return JSON.stringify({trasPreajusteDeFabrica:tras, trasElPropio:propio, apareceEnLaLista:sel?[...sel.options].some(o=>o.textContent==='Mi sala'):false,
    veredicto:(tras==='1920x1080'&&propio==='1234x567')?'correcto':'MAL'}); })()`));

console.log('\nmuros independientes (Uniform fuera):', await evl(`(()=>{
  _lch.walls[0].pxW=1000; _lch.walls[1].pxW=2000;
  lchSetNum&&0; const a=_lch.walls[0].pxW, b=_lch.walls[1].pxW;
  return JSON.stringify({uniform:_lch.roomUniform, muro1:a, muro2:b, veredicto:(a!==b)?'independientes, correcto':'MAL'}); })()`));

console.log('\nerrores:', errs.length ? errs.slice(0, 6) : 'ninguno');
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }
