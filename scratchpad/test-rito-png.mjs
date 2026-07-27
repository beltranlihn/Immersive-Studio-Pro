// Reproducción con el proyecto REAL de Beltrán: RitoDome.isp, domo 4096² a 60fps, export PNG de un composite.
// A/B con el tamaño de nest viejo (8192²) y el nuevo (4096²). NO se guarda nada sobre su proyecto.
import { targets } from './cdp.mjs';
import { spawn } from 'child_process';
const wait = ms => new Promise(r => setTimeout(r, ms));
const ROOT = 'C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro';
const PROJ = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\Rito Movie\\\\Dome\\\\RitoDome.isp';

async function conApp(fn) {
  const p = spawn(ROOT + '\\node_modules\\electron\\dist\\electron.exe', ['.', '--remote-debugging-port=9222'], { cwd: ROOT, stdio: 'ignore' });
  let idx = null;
  for (let i = 0; i < 250; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(200); }
  if (!idx) { try { p.kill(); } catch (_) {} return 'sin ventana'; }
  const ws = new WebSocket(idx.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
  let _id = 0;
  const send = (m, pr) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: pr })); });
  const errs = []; await send('Runtime.enable', {});
  ws.addEventListener('message', ev => { const x = JSON.parse(ev.data);
    if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errs.push((x.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 130));
    if (x.method === 'Runtime.exceptionThrown') errs.push('EXC ' + ((x.params.exceptionDetails.exception || {}).description || '').slice(0, 130)); });
  const evl = async e => { try { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 420000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 200) }; return r.result.value; } catch (err) { return { CAIDA: String(err.message).slice(0, 110) }; } };
  for (let i = 0; i < 150; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
  await wait(1500);
  let out;
  try { out = await fn(evl); } catch (e) { out = { CAIDA: String(e.message).slice(0, 120) }; }
  out = { ...(typeof out === 'string' ? { r: out } : out), consola: errs.slice(0, 4) };
  try { ws.close(); } catch (_) {} try { p.kill('SIGKILL'); } catch (_) {}
  await wait(2500);
  return out;
}

const abrir = `(async()=>{
  const o=document.getElementById('landingOv'); if(o)o.remove();
  await openProjectPath('${PROJ}');
  for(let i=0;i<80;i++){ if(state.media.length>3)break; await new Promise(r=>setTimeout(r,400)); }
  await new Promise(r=>setTimeout(r,4000));
  const t=document.getElementById('tourOv'); if(t)t.remove();
  const nests=state.media.filter(x=>x.kind==='nest');
  // entrar en la secuencia que TIENE los clips (la Master Sequence)
  const conClips=nests.filter(n=>(n.nestClips||[]).length);
  let dentro=null;
  if(!state.clips.length && conClips.length){ switchSeq(conClips[0].id); dentro=conClips[0].name; await new Promise(r=>setTimeout(r,2500)); }
  const ext=clipExtent(); window._RANGO=[ext[0]+0.05, ext[0]+0.40];   // 21 fotogramas DONDE HAY CONTENIDO
  const enT=state.clips.map(c=>{const m=mediaById(c.mediaId);return (m?m.kind:'?')+':'+(m?m.name:'')+' @'+c.start.toFixed(1);});
  return JSON.stringify({ medios:state.media.length, videos:state.media.filter(m=>m.kind==='video').length,
    nests:nests.map(n=>n.name+':'+(n.nestClips||[]).length), clipsEnTimeline:enT,
    extension:[+ext[0].toFixed(2),+ext[1].toFixed(2)], rango:window._RANGO.map(v=>+v.toFixed(2)),
    entradoEn:dentro, seq:state.seqW+'x'+state.seqH+'@'+(activeSeq().fps)+' '+state.seqMode }); })()`;

const correr = (viejo) => `(async()=>{
  let ultimo=0, err=null, pico=0;
  const job={ prog:(k,t)=>{ultimo=k;}, label:()=>{}, frame:()=>{}, wrote:()=>{}, done:()=>{}, fail:e=>{err=String(e&&e.message||e);} };
  let ranuras=0;
  ${viejo ? `const origSlot=nestSlot; let f=false; window.nestSlot=function(){ if(!f){ nestSize=8192; f=true; } pico=Math.max(pico,nestSize); ranuras=Math.max(ranuras,_nestPool.length+1); return origSlot.apply(null,arguments); };`
          : `const origSlot=nestSlot; window.nestSlot=function(){ pico=Math.max(pico,nestSize); ranuras=Math.max(ranuras,_nestPool.length+1); return origSlot.apply(null,arguments); };`}
  try{ await runExport({codec:'png', res:4096, outW:4096, outH:4096, fps:60, bitrate:1e8, range:'clips', rangeT:window._RANGO, job}); }
  catch(e){ err=String(e&&e.message||e); }
  window.nestSlot=origSlot;
  return JSON.stringify({ultimoFotograma:ultimo, err, nestSizeUsado:pico, ranurasMax:ranuras, vramNests:Math.round(pico*pico*4*ranuras/1e6)+' MB',
    mbPorRanura:Math.round(pico*pico*4/1e6), ctxPerdido:gl.isContextLost(), glLost:(typeof glLost!=='undefined'?glLost:'?')}); })()`;

for (const [nombre, viejo] of [['VIEJO · nests a 8192²', true], ['NUEVO · nests a 4096²', false]]) {
  const r = await conApp(async evl => {
    const m = await evl(abrir);
    if (typeof m !== 'string') return { abrir: m };
    console.log('  proyecto:', m);
    return { export: await evl(correr(viejo)) };
  });
  console.log(nombre.padEnd(24), JSON.stringify(r));
}
