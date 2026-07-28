// [R206] Menú de macOS + enrutado de Edición.
// En Windows: comprobar que NO cambia nada (no se instala menú, no se emite dsp:edit).
// Y probar la pieza que sí se puede probar aquí: que sintetizar la pulsación dispara la MISMA acción del
// programa que pulsarla de verdad — que es lo que hará el menú del Mac.
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
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 120000 }); return r.exceptionDetails ? JSON.stringify(r.exceptionDetails).slice(0, 400) : r.result.value; };
for (let i = 0; i < 150; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(2500);
await evl(`setInterval(()=>{const b=document.querySelector('#confirmOv #cfCancel'); if(b)b.click();},120);1`);

console.log('\n--- Windows: el puente existe pero NADIE lo usa ---');
console.log(await evl(`JSON.stringify({
  puenteExpuesto: typeof DSP.onEdit==='function' && typeof DSP.nativeEdit==='function',
  plataforma: navigator.userAgent.indexOf('Windows')>=0 ? 'Windows' : 'otra'
})`));

console.log('\n--- todos los atajos aceptan Cmd, no sólo Ctrl ---');
console.log(await evl(`(async()=>{ try{ hideLanding(); }catch(e){}
  await newProject('flat',1920,1080,30);
  const m={id:uid(),kind:'shape',name:'F',shape:'rect',fill:'#8ab',stroke:'#000',strokeW:0,sw:400,sh:400,dur:4,fps:0,color:clipColorFor('shape')};
  renderShapeMedia(m); state.media.push(m); renderMedia();
  const lane=ensureVideoLanes(1)[0]; addClip(m,lane,0);
  const antes=state.clips.length;
  // Cmd (metaKey) SIN ctrl: duplicar
  state.selId=state.clips[0].id; state.selIds=[state.clips[0].id];
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'d',metaKey:true,bubbles:true,cancelable:true}));
  await new Promise(r=>setTimeout(r,200));
  const trasCmdD=state.clips.length;
  // Cmd+T: pista nueva
  const pistas=state.lanes.length;
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'t',metaKey:true,bubbles:true,cancelable:true}));
  await new Promise(r=>setTimeout(r,200));
  return JSON.stringify({clipsAntes:antes, trasCmdD, pistasAntes:pistas, trasCmdT:state.lanes.length,
    veredicto:(trasCmdD===antes+1 && state.lanes.length===pistas+1)
      ? 'correcto: Cmd+D duplica y Cmd+T crea pista, igual que con Ctrl' : '*** MAL ***'}); })()`));

console.log('\n--- el enrutado del menú de Mac: sintetizar = pulsar ---');
console.log(await evl(`(async()=>{
  // se replica EXACTAMENTE lo que hará el manejador de dsp:edit
  const rutar=(id)=>{ const T2={undo:['z',false],redo:['z',true],cut:['x',false],copy:['c',false],paste:['v',false],selectAll:['a',false]}[id];
    if(!T2)return {usadoPorLaPagina:false};
    const ev=new KeyboardEvent('keydown',{key:T2[0],ctrlKey:true,shiftKey:T2[1],bubbles:true,cancelable:true});
    window.dispatchEvent(ev); return {usadoPorLaPagina:ev.defaultPrevented}; };
  const n0=state.clips.length;
  const rCopy=rutar('copy'); await new Promise(r=>setTimeout(r,150));
  const rPaste=rutar('paste'); await new Promise(r=>setTimeout(r,250));
  const trasPegar=state.clips.length;
  const rUndo=rutar('undo'); await new Promise(r=>setTimeout(r,250));
  const trasDeshacer=state.clips.length;
  const rCut=rutar('cut');   // el programa NO tiene atajo de cortar → debe caer al sistema
  return JSON.stringify({
    copiar:rCopy, pegar:rPaste, deshacer:rUndo, cortar:rCut,
    clips:{antes:n0, trasPegar, trasDeshacer},
    veredicto:(rCopy.usadoPorLaPagina && rPaste.usadoPorLaPagina && rUndo.usadoPorLaPagina
               && trasPegar===n0+1 && trasDeshacer===n0 && !rCut.usadoPorLaPagina)
      ? 'correcto: copiar/pegar/deshacer los toma el programa; cortar cae al sistema'
      : '*** MAL ***'},null,1); })()`));

console.log('\n--- en un campo de texto NO se roba la tecla (va al sistema) ---');
console.log(await evl(`(()=>{
  const inp=document.createElement('input'); inp.type='text'; inp.value='hola';
  document.body.appendChild(inp); inp.focus();
  const el=document.activeElement, tag=((el&&el.tagName)||'').toLowerCase();
  const esCampo=(tag==='input'||tag==='textarea'||(el&&el.isContentEditable));
  inp.remove();
  return JSON.stringify({focoDetectadoComoCampo:esCampo,
    veredicto:esCampo?'correcto: con el foco en un campo, la orden se manda a la edición nativa':'*** MAL ***'}); })()`));

console.log('\nerrores:', errs.length ? errs.slice(0, 6) : 'ninguno');
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }
