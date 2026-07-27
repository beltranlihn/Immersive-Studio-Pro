// Export PNG de domo 4096² con nests: ¿cuánta VRAM reserva y sobrevive?
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 300; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
if (!idx) { console.log('sin ventana'); process.exit(1); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data);
  if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errs.push((x.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 160));
  if (x.method === 'Runtime.exceptionThrown') errs.push('EXC ' + ((x.params.exceptionDetails.exception || {}).description || '').slice(0, 160)); });
const evl = async e => { try { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 300000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 250) }; return r.result.value; } catch (err) { return { CAIDA: String(err.message).slice(0, 120) }; } };
for (let i = 0; i < 120; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1300);

const SRC = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\Rito Movie\\\\Asset\\\\Creation\\\\';
const OUT = 'C:\\\\Users\\\\beltr\\\\AppData\\\\Local\\\\Temp\\\\claude\\\\pngcrash';

console.log('montaje domo 4096² con 2 nests de 4 clips:', await evl(`(async()=>{
  const o=document.getElementById('landingOv'); if(o)o.remove(); const t=document.getElementById('tourOv'); if(t)t.remove();
  const as=activeSeq(); as.w=4096;as.h=4096;as.mode='dome';as.fps=30; state.seqW=4096;state.seqH=4096;state.seqMode='dome';state.fps=30;
  await DSP.ensureDir('${OUT}'); currentPath='${OUT}\\\\p.isp';
  const meds=[]; for(const n of ['Front1','Front2','Front3']){ const m=await addVideoFromPath('${SRC}'+n+'.mp4',n); if(m)meds.push(m); }
  if(meds.length<3)return'sin videos';
  state.clips=[]; state.media=state.media.filter(x=>x.kind!=='nest');
  for(let k=0;k<2;k++){ const nl=[],ncl=[];
    for(let i=0;i<4;i++){ nl.push({id:uid(),name:'V'+(i+1),tag:'V'+(i+1),kind:'video'});
      const c=makeClip(meds[i%3],i,0); c.start=0;c.dur=2;c.inP=3+i*0.4; c.props.az=i*90+k*45; c.props.el=28; c.props.size=45; ncl.push(c); }
    const nest={id:uid(),name:'Comp'+k,kind:'nest',w:4096,h:4096,dur:2,fps:30,mode:'dome',
      nestClips:ncl,nestLanes:nl,nestMarkers:[],nestGroups:[],tex:newTex(),thumb:null,color:clipColorFor('nest'),folder:null};
    state.media.push(nest); adopt(nest);
    const nc=makeClip(nest,k,0); nc.start=0;nc.dur=2;nc.inP=0; state.clips.push(nc); }
  state.workIn=null;state.workOut=null; renderMedia(); renderTimeline(); render();
  // el camino PNG pide una CARPETA (dialogo nativo) -> se intercepta para no bloquear
  window._origRun=runExport; window.runExport=function(op){ return window._origRun(op); };
  window._origDir=DSP.chooseExportDir;
  return JSON.stringify({clips:state.clips.length, nests:state.media.filter(x=>x.kind==='nest').length, maxTex:gl.getParameter(gl.MAX_TEXTURE_SIZE)}); })()`));

console.log('\nreserva de VRAM prevista (antes vs ahora):', await evl(`(()=>{
  const qRes=4096, glMax=gl.getParameter(gl.MAX_TEXTURE_SIZE)||8192;
  const antes=Math.min(qRes*exportSS(qRes), glMax, 8192);
  const ahora=Math.min(qRes*1, glMax, 8192);            // PNG ya no supersamplea los nests
  const mb=s=>Math.round(s*s*4/1e6);
  return JSON.stringify({ nestSizeAntes:antes, porRanuraAntes:mb(antes)+' MB',
    nestSizeAhora:ahora, porRanuraAhora:mb(ahora)+' MB',
    conDosNests:{antes:mb(antes)*2+' MB', ahora:mb(ahora)*2+' MB'} }); })()`));

// PNG a disco necesita chooseExportDir: se sortea llamando a runExport directo con un job propio
console.log('\nlanzando export PNG real (30 fotogramas)…');
const res = await evl(`(async()=>{
  let ultimo=0, err=null;
  const job={ prog:(k,t)=>{ultimo=k;}, label:()=>{}, frame:()=>{}, wrote:()=>{}, done:()=>{}, fail:e=>{err=String(e&&e.message||e);} };
  // se fuerza la carpeta para que no salga el dialogo nativo
  const dir='${OUT}';
  const orig=DSP.chooseExportDir;
  try{
    await runExport({codec:'png', res:4096, outW:4096, outH:4096, fps:30, bitrate:1e8, range:'clips', rangeT:[0,1], job});
  }catch(e){ err=String(e&&e.message||e); }
  return JSON.stringify({ultimoFotograma:ultimo, err, nestSize:(typeof nestSize!=='undefined'?nestSize:null), exporting:exporting}); })()`);
console.log('resultado:', res);

console.log('\ncontexto WebGL vivo:', await evl(`(()=>JSON.stringify({perdido:(typeof glLost!=='undefined'?glLost:'?'), ctxLost:gl.isContextLost()}))()`));
console.log('\nerrores:', errs.length ? errs.slice(0, 8) : 'ninguno');
ws.close();
