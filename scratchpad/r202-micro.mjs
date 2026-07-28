// [R202] micro-sonda: ¿qué devuelve compElProps con noWarp, y qué llega de verdad a createComposition?
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
await send('Runtime.enable', {});
const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 120000 }); return r.exceptionDetails ? JSON.stringify(r.exceptionDetails).slice(0, 400) : r.result.value; };
for (let i = 0; i < 150; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(2500);
await evl(`setInterval(()=>{const b=document.querySelector('#confirmOv #cfCancel'); if(b)b.click();},120);1`);

console.log('compElProps directo:', await evl(`(()=>{
  const pt={az:0,el:30,size:40,_secAz:60,_secEl:30};
  return JSON.stringify({
    sinNoWarp:compElProps({kind:'domegrid',size:40,mask:'none'},pt),
    conNoWarp:compElProps({kind:'domegrid',size:40,mask:'none',noWarp:true},pt) }); })()`));

console.log('\nCLIP_COLORS:', await evl(`JSON.stringify((typeof CLIP_COLORS!=='undefined')?CLIP_COLORS.slice(0,4):'no existe')`));

console.log('\nqué pone el diálogo en opts:', await evl(`(async()=>{ try{ hideLanding(); }catch(e){}
  await newProject('dome',2048,2048,60,180);
  const m={id:uid(),kind:'shape',name:'T',shape:'rect',fill:'#8ab',stroke:'#000',strokeW:0,sw:1600,sh:900,dur:6,fps:0,color:clipColorFor('shape')};
  renderShapeMedia(m); state.media.push(m); renderMedia();
  document.querySelectorAll('#compOv').forEach(x=>x.remove());
  openCompose('domegrid');
  document.getElementById('cRings').value=3; document.getElementById('cSegs').value=6;
  const box=document.getElementById('cNoWarp'); box.checked=true;
  // interceptar createComposition para ver los opts REALES
  const orig=window.createComposition; let vistos=null;
  window.createComposition=o=>{ vistos={noWarp:o.noWarp, kind:o.kind, rings:o.rings, segs:o.segs}; return orig(o); };
  document.getElementById('cGo').onclick();
  window.createComposition=orig;
  const nest=state.media.filter(x=>isSeqMedia(x)&&x.comp).pop();
  const c0=nest&&nest.nestClips&&nest.nestClips[0];
  return JSON.stringify({optsVistos:vistos, compNoWarp:nest&&nest.comp.noWarp,
    primerClipProps:c0?{warp:c0.props.warp, secAz:c0.props.secAz, secEl:c0.props.secEl, size:c0.props.size}:null}); })()`));
try { ws.close(); } catch (_) { } try { p.kill('SIGKILL'); } catch (_) { }
