// ¿Dónde se va el tiempo en un export PNG? Se cronometra cada etapa por separado sobre el proyecto de Beltrán.
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
await send('Runtime.enable', {});
const evl = async e => { try { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 600000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 250) }; return r.result.value; } catch (err) { return { CAIDA: String(err.message).slice(0, 110) }; } };
for (let i = 0; i < 150; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1500);

console.log('proyecto:', await evl(`(async()=>{
  const o=document.getElementById('landingOv'); if(o)o.remove();
  await openProjectPath('${PROJ}');
  for(let i=0;i<80;i++){ if(state.media.length>2)break; await new Promise(r=>setTimeout(r,400)); }
  await new Promise(r=>setTimeout(r,5000));
  const t=document.getElementById('tourOv'); if(t)t.remove();
  const ext=clipExtent();
  return JSON.stringify({ seq:state.seqW+'x'+state.seqH+'@'+activeSeq().fps+' '+state.seqMode,
    clips:state.clips.length, medios:state.media.map(m=>m.kind+':'+m.name),
    extension:[+ext[0].toFixed(2),+ext[1].toFixed(2)] }); })()`));

// se cronometra CADA etapa del bucle PNG, replicandolo a mano sobre 12 fotogramas
console.log('\ncronometraje por etapa (12 fotogramas, 4096² dome):');
console.log(await evl(`(async()=>{
  const fps=60, res=4096, t0=clipExtent()[0];
  const bak={cw:glc.width,ch:glc.height,ns:nestSize,eq:_exportQuality,ex:exporting};
  exporting=true; _exportQuality=true;
  const glMax=gl.getParameter(gl.MAX_TEXTURE_SIZE)||8192; nestSize=Math.min(res,glMax,8192);
  glc.width=res; glc.height=res;
  const T={seek:0,prep:0,comp:0,blob:0,write:0,total:0}, N=12;
  let bytes=0;
  const dir=(currentPath||'').replace(/[^\\\\/]+$/,'')+'perftmp';
  await DSP.ensureDir(dir);
  const t00=performance.now();
  for(let i=0;i<N;i++){
    const t=t0+i/fps;
    let a=performance.now(); await seekExport(t); T.seek+=performance.now()-a;   // la MISMA funcion que usa runExport, no una copia
    a=performance.now(); prepNests(state.clips,t,0); gl.finish(); T.prep+=performance.now()-a;
    a=performance.now(); composite(t,res,false); gl.finish(); T.comp+=performance.now()-a;
    a=performance.now(); const blob=await new Promise(r=>glc.toBlob(r,'image/png')); T.blob+=performance.now()-a;
    bytes+=blob.size;
    a=performance.now(); const buf=new Uint8Array(await blob.arrayBuffer()); await DSP.writeBinary(dir+'/f'+i+'.png',buf); T.write+=performance.now()-a;
  }
  T.total=performance.now()-t00;
  glc.width=bak.cw; glc.height=bak.ch; nestSize=bak.ns; _exportQuality=bak.eq; exporting=bak.ex;
  const per=k=>+(T[k]/N).toFixed(0);
  return JSON.stringify({ msPorFotograma:{ seek:per('seek'), prepNests:per('prep'), composite:per('comp'),
      pngEncode:per('blob'), escribirDisco:per('write'), TOTAL:per('total') },
    fps:+(N/(T.total/1000)).toFixed(2), mbPorPng:+(bytes/N/1e6).toFixed(1),
    reparto:Object.fromEntries(['seek','prep','comp','blob','write'].map(k=>[k, Math.round(T[k]/T.total*100)+'%'])) },null,1); })()`));

console.log('\ninstancias de vídeo que hay que reposicionar por fotograma:', await evl(`(()=>{
  const t=clipExtent()[0]+0.2; const d=collectDrawnVideoClips(state.clips,state.lanes,t,0,[]);
  return JSON.stringify({ cuantas:d.length, medios:[...new Set(d.map(x=>x.m.name))],
    caminoWebCodecs:state.view.wcDecode, sePermiteEnExport:'_useCD exige !_exportQuality → NO' }); })()`));
try { ws.close(); } catch (_) {} try { p.kill('SIGKILL'); } catch (_) {}
