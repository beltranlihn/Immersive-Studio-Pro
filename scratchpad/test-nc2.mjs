// Con el caché ya vivo: velocidad, invalidación, y LO CRÍTICO — que el export vuelva a las fuentes.
import { evalInApp } from './cdp.mjs';
const P = { port: 9222 };
const bench = `(async()=>{
  const t0=performance.now(); const N=24;
  for(let i=0;i<N;i++){ state.playhead=0.05+i*0.06;
    await Promise.all(collectDrawnVideoClips(state.clips,state.lanes,state.playhead,0,[]).map(({c,m,local})=>vinstSeek(c,m,local)));
    prepNests(state.clips,state.playhead,0);
    gl.bindFramebuffer(gl.FRAMEBUFFER,compFBO); composite(state.playhead,compSize,false); gl.bindFramebuffer(gl.FRAMEBUFFER,null); }
  gl.finish(); const ms=performance.now()-t0;
  return JSON.stringify({ msPorFotograma:+(ms/N).toFixed(1), fps:+(N/(ms/1000)).toFixed(1),
    decodificadores:collectDrawnVideoClips(state.clips,state.lanes,0.5,0,[]).length,
    cacheUsable:ncUsable(mediaById(window._NEST)) });
})()`;

console.log('calentar el caché…');
await evalInApp(`(async()=>{ state.playhead=0.5; await scrubRender(); await new Promise(r=>setTimeout(r,1200)); return true; })()`, P);

console.log('\nCON caché:', await evalInApp(bench, P));

console.log('\nSIN caché (mismo montaje, caché desactivado a mano):', await evalInApp(`(async()=>{
  state.view.useNestCache=false; await scrubRender(); await new Promise(r=>setTimeout(r,800));
  const r=await (${bench}); state.view.useNestCache=true; await scrubRender(); return r; })()`, P));

console.log('\ninvalidación:', await evalInApp(`(async()=>{
  const m=mediaById(window._NEST);
  const antes={rancio:!!m.ncStale,usable:ncUsable(m)};
  m.nestClips[0].props.az=175; markDirty(); await new Promise(r=>setTimeout(r,600));
  const trasEditar={rancio:!!m.ncStale,usable:ncUsable(m)};
  const chapa=(()=>{const e=document.querySelector('.clip .cnc');return e?e.textContent.trim()+(e.classList.contains('stale')?' [rojo]':''):null;})();
  m.nestClips[0].props.az=115; markDirty(); await new Promise(r=>setTimeout(r,600));   // volver al valor original
  const trasRevertir={rancio:!!m.ncStale,usable:ncUsable(m)};
  return JSON.stringify({antes,trasEditar,chapaEnLaLineaDeTiempo:chapa,trasRevertir,
    veredicto:(antes.usable&&trasEditar.rancio&&!trasEditar.usable&&!trasRevertir.rancio)?'CORRECTO':'REVISAR'},null,1); })()`, P));

console.log('\nEL EXPORT VUELVE A LAS FUENTES:', await evalInApp(`(()=>{
  const m=mediaById(window._NEST); const c=state.clips.find(x=>x.mediaId===m.id);
  const prev={usable:ncUsable(m),url:_vinstUrl(m),decod:collectDrawnVideoClips(state.clips,state.lanes,0.5,0,[]).length,
              audio:collectAudioEvents(state.clips,state.lanes,0,0,Infinity,0,[]).length};
  _exportQuality=true;                                  // exactamente lo que hace runExport
  const exp={usable:ncUsable(m),url:_vinstUrl(m),instancia:!!vinstEnsure(c,m),
             decod:collectDrawnVideoClips(state.clips,state.lanes,0.5,0,[]).length};
  _exportQuality=false;
  return JSON.stringify({enPreview:prev,enExport:exp,
    veredicto:(prev.usable===true&&prev.decod===1&&exp.usable===false&&exp.url===null&&exp.instancia===false&&exp.decod>1)
      ?'CORRECTO: preview usa 1 decodificador desde el caché; el export lo ignora y recompone desde las '+exp.decod+' fuentes'
      :'REVISAR'},null,1); })()`, P));

console.log('\npersistencia:', await evalInApp(`(()=>{ const m=mediaById(window._NEST); const s=serMedia(m);
  return JSON.stringify({guarda:{ncPath:!!s.ncPath,ncSig:!!s.ncSig,ncW:s.ncW,ncH:s.ncH,ncFps:s.ncFps},firmaCoincide:(s.ncSig===nestSig(m))}); })()`, P));

console.log('\nnest apagado ya no compone (la guarda de prepNests):', await evalInApp(`(async()=>{
  const c=state.clips.find(x=>mediaById(x.mediaId).kind==='nest');
  state.view.useNestCache=false; c.disabled=false; await scrubRender(); await new Promise(r=>setTimeout(r,600));
  const t0=performance.now(); for(let i=0;i<12;i++){ prepNests(state.clips,0.3+i*0.05,0); } gl.finish(); const encendido=(performance.now()-t0)/12;
  c.disabled=true;
  const t1=performance.now(); for(let i=0;i<12;i++){ prepNests(state.clips,0.3+i*0.05,0); } gl.finish(); const apagado=(performance.now()-t1)/12;
  c.disabled=false; state.view.useNestCache=true; await scrubRender();
  return JSON.stringify({msEncendido:+encendido.toFixed(1),msApagado:+apagado.toFixed(1),
    veredicto:(apagado<encendido*0.5)?'CORRECTO: apagado ya no cuesta':'REVISAR'}); })()`, P));
