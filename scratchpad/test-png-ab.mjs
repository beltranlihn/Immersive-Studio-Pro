// A/B: el MISMO export PNG con el tamaño de nest VIEJO (8192) y con el nuevo (4096).
// Si con 8192 se pierde el contexto y con 4096 no, la causa queda establecida.
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
async function conApp(fn) {
  let idx = null;
  for (let i = 0; i < 200; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(200); }
  if (!idx) return 'sin ventana';
  const ws = new WebSocket(idx.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
  let _id = 0;
  const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
  await send('Runtime.enable', {});
  const evl = async e => { try { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 300000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 200) }; return r.result.value; } catch (err) { return { CAIDA: String(err.message).slice(0, 100) }; } };
  for (let i = 0; i < 120; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
  await wait(1300);
  const out = await fn(evl);
  try { ws.close(); } catch (_) {}
  return out;
}

const SRC = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\Rito Movie\\\\Asset\\\\Creation\\\\';
const OUT = 'C:\\\\Users\\\\beltr\\\\AppData\\\\Local\\\\Temp\\\\claude\\\\pngab';

const montaje = `(async()=>{
  const o=document.getElementById('landingOv'); if(o)o.remove(); const t=document.getElementById('tourOv'); if(t)t.remove();
  const as=activeSeq(); as.w=4096;as.h=4096;as.mode='dome';as.fps=30; state.seqW=4096;state.seqH=4096;state.seqMode='dome';state.fps=30;
  await DSP.ensureDir('${OUT}'); currentPath='${OUT}\\\\p.isp';
  const meds=[]; for(const n of ['Front1','Front2','Front3']){ const m=await addVideoFromPath('${SRC}'+n+'.mp4',n); if(m)meds.push(m); }
  if(meds.length<3)return'sin videos';
  state.clips=[]; state.media=state.media.filter(x=>x.kind!=='nest');
  for(let k=0;k<4;k++){ const nl=[],ncl=[];               // CUATRO nests a la vista: carga realista de Beltran
    for(let i=0;i<4;i++){ nl.push({id:uid(),name:'V'+(i+1),tag:'V'+(i+1),kind:'video'});
      const c=makeClip(meds[i%3],i,0); c.start=0;c.dur=2;c.inP=3+i*0.4; c.props.az=i*90+k*22; c.props.el=28; c.props.size=45; ncl.push(c); }
    const nest={id:uid(),name:'C'+k,kind:'nest',w:4096,h:4096,dur:2,fps:30,mode:'dome',
      nestClips:ncl,nestLanes:nl,nestMarkers:[],nestGroups:[],tex:newTex(),thumb:null,color:clipColorFor('nest'),folder:null};
    state.media.push(nest); adopt(nest);
    const nc=makeClip(nest,k,0); nc.start=0;nc.dur=2;nc.inP=0; state.clips.push(nc); }
  state.workIn=null;state.workOut=null; renderMedia(); renderTimeline(); render();
  return JSON.stringify({clips:state.clips.length, nests:4}); })()`;

const correr = (forzar8192) => `(async()=>{
  let ultimo=0, err=null;
  const job={ prog:(k,t)=>{ultimo=k;}, label:()=>{}, frame:()=>{}, wrote:()=>{}, done:()=>{}, fail:e=>{err=String(e&&e.message||e);} };
  ${forzar8192 ? `
  // COMPORTAMIENTO VIEJO: se re-fuerza nestSize al doble justo despues de que runExport lo fije
  const origSlot=nestSlot; let forzado=false;
  window.nestSlot=function(){ if(!forzado){ nestSize=8192; forzado=true; } return origSlot.apply(null,arguments); };
  ` : ''}
  try{ await runExport({codec:'png', res:4096, outW:4096, outH:4096, fps:30, bitrate:1e8, range:'clips', rangeT:[0,1.2], job}); }
  catch(e){ err=String(e&&e.message||e); }
  ${forzar8192 ? 'window.nestSlot=origSlot;' : ''}
  return JSON.stringify({ultimoFotograma:ultimo, err, ctxPerdido:gl.isContextLost(), glLost:(typeof glLost!=='undefined'?glLost:'?')}); })()`;

for (const [nombre, forzar] of [['VIEJO · nests a 8192²', true], ['NUEVO · nests a 4096²', false]]) {
  const { spawn } = await import('child_process');
  const ROOT = 'C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro';
  const p = spawn(ROOT + '\\node_modules\\electron\\dist\\electron.exe', ['.', '--remote-debugging-port=9222'], { cwd: ROOT, stdio: 'ignore' });
  await wait(1000);
  const r = await conApp(async evl => {
    const m = await evl(montaje);
    if (typeof m !== 'string') return { montaje: m };
    return await evl(correr(forzar));
  });
  console.log(nombre.padEnd(24), r);
  try { p.kill('SIGKILL'); } catch (_) {}
  await wait(2500);
}
