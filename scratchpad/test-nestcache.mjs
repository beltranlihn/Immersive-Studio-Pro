// R180 · Caché de nest: ¿acelera? ¿se invalida al editar? ¿el export vuelve a las FUENTES?
import { targets } from './cdp.mjs';
const wait = ms => new Promise(r => setTimeout(r, ms));
let idx = null;
for (let i = 0; i < 300; i++) { const l = await targets(9222).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(150); }
if (!idx) { console.log('la app no arrancó'); process.exit(1); }
const ws = new WebSocket(idx.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
let _id = 0;
const send = (m, p) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: p })); });
const errs = []; await send('Runtime.enable', {});
ws.addEventListener('message', ev => { const x = JSON.parse(ev.data);
  if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') errs.push((x.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 200));
  if (x.method === 'Runtime.exceptionThrown') errs.push('excepción: ' + ((x.params.exceptionDetails.exception && x.params.exceptionDetails.exception.description) || '').slice(0, 220)); });
const evl = async (e, t = 900000) => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: t }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 400) }; return r.result.value; };
for (let i = 0; i < 90; i++) { if (await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")') === true) break; await wait(400); }
await wait(1500);

const SRC = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\Rito Movie\\\\Asset\\\\Creation\\\\';
const OUT = 'C:\\\\Users\\\\beltr\\\\AppData\\\\Local\\\\Temp\\\\claude\\\\nc-test';

// 1. Domo 4096² con un NEST de 6 clips dentro
console.log('montaje:', JSON.stringify(await evl(`(async()=>{
  const ov=document.getElementById('landingOv'); if(ov)ov.remove();
  const t=document.getElementById('tourOv'); if(t)t.remove();
  const as=activeSeq(); as.w=4096; as.h=4096; as.fps=60; state.fps=60; state.seqW=4096; state.seqH=4096; state.seqMode='dome';
  await DSP.ensureDir('${OUT}'); currentPath='${OUT}\\\\prueba.isp';
  const names=['Front1','Front2','Front3','Front4','Front5'];
  const meds=[];
  for(const n of names){ const m=await addVideoFromPath('${SRC}'+n+'.mp4',n); if(m)meds.push(m); }
  if(meds.length<3) return {error:'no cargaron los vídeos: '+meds.length};
  // nest con 6 clips (repetimos medios) en 6 pistas internas
  const nestLanes=[],nestClips=[];
  for(let i=0;i<6;i++){ nestLanes.push({id:uid(),name:'V'+(i+1),tag:'V'+(i+1),kind:'video'});
    const m=meds[i%meds.length]; const c=makeClip(m,i,0); c.start=0; c.dur=2.0; c.inP=3+i*0.3;
    c.props.az=i*60; c.props.el=30; c.props.size=40; c.props.opacity=80; nestClips.push(c); }
  const nest={id:uid(),name:'Compose Domo',kind:'nest',w:4096,h:4096,dur:2.0,fps:60,mode:'dome',
    nestClips,nestLanes,nestMarkers:[],nestGroups:[],tex:newTex(),thumb:null,color:clipColorFor('nest'),folder:null};
  state.media.push(nest); adopt(nest);
  state.clips=[]; const nc=makeClip(nest,0,0); nc.start=0; nc.dur=2.0; nc.inP=0; nc.props.fulldome=false; state.clips.push(nc);
  window._NEST=nest.id; window._NC=nc.id;
  renderMedia(); renderTimeline(); render();
  return { nest:nest.name, clipsDentro:nest.nestClips.length, mediosCargados:meds.length, firma:nestSig(nest).slice(0,14) };
})()`), null, 1));

// 2. Velocidad SIN caché
const bench = `(async()=>{
  const t0=performance.now(); const N=24;
  for(let i=0;i<N;i++){ state.playhead=0.05+i*0.06;
    await Promise.all(collectDrawnVideoClips(state.clips,state.lanes,state.playhead,0,[]).map(({c,m,local})=>vinstSeek(c,m,local)));
    prepNests(state.clips,state.playhead,0);
    gl.bindFramebuffer(gl.FRAMEBUFFER,compFBO); composite(state.playhead,compSize,false); gl.bindFramebuffer(gl.FRAMEBUFFER,null); }
  gl.finish(); const ms=performance.now()-t0;
  return { msPorFotograma:+(ms/N).toFixed(1), fps:+(N/(ms/1000)).toFixed(1),
           instanciasDeVideo:_vinst.size,
           decodificadoresActivos:collectDrawnVideoClips(state.clips,state.lanes,0.5,0,[]).length };
})()`;
console.log('\nSIN caché:', JSON.stringify(await evl(bench)));

// 3. Generar el caché
console.log('\ngenerando caché…');
await evl(`(()=>{ window._P=ncBuild(mediaById(window._NEST)); return true; })()`);
for (let i = 0; i < 60; i++) { if (await evl(`!!document.getElementById('ncGo')`)) break; await wait(300); }
console.log('diálogo:', JSON.stringify(await evl(`(()=>{ const s=document.getElementById('ncRes');
  return { opciones:[...s.options].map(o=>o.textContent), elegido:s.options[s.selectedIndex].textContent, info:document.getElementById('ncInfo').textContent }; })()`), null, 1));
await evl(`document.getElementById('ncGo').click()`);
for (let i = 0; i < 40; i++) { if (await evl(`!!document.getElementById('ripPv')`)) break; await wait(250); }
for (let i = 0; i < 200; i++) { if (!(await evl(`!!document.getElementById('ripPv')`))) break; if (i % 8 === 0) console.log('   ', await evl(`(()=>{const p=document.getElementById('ripPct');return p?p.textContent:'';})()`)); await wait(1500); }
await wait(2500);
console.log('caché:', JSON.stringify(await evl(`(async()=>{ const m=mediaById(window._NEST);
  let st=null; try{ st=await DSP.stat(m.ncPath||''); }catch(e){}
  return { path:(m.ncPath||'').split('\\\\').pop(), MB:st?+(st.size/1e6).toFixed(2):null, listo:!!m.ncReady, rancio:!!m.ncStale, dim:m.ncW+'x'+m.ncH, usable:ncUsable(m) }; })()`), null, 1));

// 4. Velocidad CON caché
await evl(`(async()=>{ state.playhead=0.5; await scrubRender(); return true; })()`);
await wait(1500);
console.log('\nCON caché:', JSON.stringify(await evl(bench)));

// 5. ¿Se invalida al editar dentro del nest?
console.log('\ninvalidación:', JSON.stringify(await evl(`(async()=>{
  const m=mediaById(window._NEST); const antes={rancio:!!m.ncStale,usable:ncUsable(m)};
  m.nestClips[0].props.az=175; markDirty();
  await new Promise(r=>setTimeout(r,500));
  const despues={rancio:!!m.ncStale,usable:ncUsable(m)};
  m.nestClips[0].props.az=0; markDirty();          // deshacer el cambio → debe volver a valer
  await new Promise(r=>setTimeout(r,500));
  const revertido={rancio:!!m.ncStale,usable:ncUsable(m)};
  return {antes,trasEditar:despues,trasRevertir:revertido}; })()`), null, 1));

// 6. LO CRÍTICO: ¿el export ignora el caché?
console.log('\nel export vuelve a las fuentes:', JSON.stringify(await evl(`(()=>{
  const m=mediaById(window._NEST);
  const prev=ncUsable(m);
  _exportQuality=true;                       // exactamente lo que hace runExport
  const durante={ usable:ncUsable(m), url:_vinstUrl(m), instancia:!!vinstEnsure(clipById(window._NC),m) };
  const audio=collectAudioEvents(state.clips,state.lanes,0,0,Infinity,0,[]).length;
  const decod=collectDrawnVideoClips(state.clips,state.lanes,0.5,0,[]).length;
  _exportQuality=false;
  return { enPreview:prev, enExport:durante, decodificadoresEnExport:decod,
           veredicto:(prev===true && durante.usable===false && durante.url===null && decod>1)?'CORRECTO: en export se recompone desde las fuentes':'MAL' }; })()`), null, 1));

// 7. Persistencia
console.log('\npersistencia:', JSON.stringify(await evl(`(()=>{
  const m=mediaById(window._NEST); const s=serMedia(m);
  return { guarda:{ncPath:!!s.ncPath,ncSig:!!s.ncSig,ncW:s.ncW,ncH:s.ncH}, firmaCoincide:(s.ncSig===nestSig(m)) }; })()`), null, 1));

console.log('\nerrores:', errs.length ? errs.slice(0, 10) : 'ninguno');
ws.close();
