// Repesca: revertir al valor REAL (az=0, que es i*60 con i=0) y luego el test de export con caché válido.
import { evalInApp } from './cdp.mjs';
const P = { port: 9222 };

console.log('revertir de verdad:', await evalInApp(`(async()=>{
  const m=mediaById(window._NEST);
  const roto={rancio:!!m.ncStale};
  m.nestClips[0].props.az=0; markDirty(); await new Promise(r=>setTimeout(r,700));   // 0 = i*60 con i=0, el valor con el que se horneó
  const sano={rancio:!!m.ncStale,usable:ncUsable(m),firmaCoincide:(m.ncSig===nestSig(m))};
  return JSON.stringify({conElCambio:roto,trasRevertirDeVerdad:sano,
    veredicto:(roto.rancio&&!sano.rancio&&sano.usable)?'CORRECTO: la firma es reversible — deshacer devuelve el caché a la vida':'REVISAR'},null,1); })()`, P));

console.log('\ncalentando…');
await evalInApp(`(async()=>{ state.playhead=0.5; await scrubRender(); await new Promise(r=>setTimeout(r,1500)); return true; })()`, P);

console.log('\nEL EXPORT VUELVE A LAS FUENTES:', await evalInApp(`(()=>{
  const m=mediaById(window._NEST); const c=state.clips.find(x=>x.mediaId===m.id);
  const prev={usable:ncUsable(m),urlEsElCache:/nest proxies/.test(_vinstUrl(m)||''),decod:collectDrawnVideoClips(state.clips,state.lanes,0.5,0,[]).length};
  _exportQuality=true;
  const exp={usable:ncUsable(m),url:_vinstUrl(m),instancia:!!vinstEnsure(c,m),
             decod:collectDrawnVideoClips(state.clips,state.lanes,0.5,0,[]).length,
             audioDesciende:collectAudioEvents(state.clips,state.lanes,0,0,Infinity,0,[]).length};
  _exportQuality=false;
  const vuelve={usable:ncUsable(m),decod:collectDrawnVideoClips(state.clips,state.lanes,0.5,0,[]).length};
  return JSON.stringify({enPreview:prev,enExport:exp,alVolverAPreview:vuelve,
    veredicto:(prev.usable===true&&prev.decod===1&&prev.urlEsElCache&&exp.usable===false&&exp.url===null&&exp.instancia===false&&exp.decod===6&&vuelve.usable===true&&vuelve.decod===1)
      ?'CORRECTO: preview = 1 decodificador desde el caché · export = ignora el caché y recompone desde las 6 fuentes · vuelve solo'
      :'REVISAR'},null,1); })()`, P));

console.log('\npersistencia:', await evalInApp(`(()=>{ const m=mediaById(window._NEST); const s=serMedia(m);
  return JSON.stringify({guarda:{ncPath:!!s.ncPath,ncSig:!!s.ncSig,ncW:s.ncW,ncH:s.ncH,ncFps:s.ncFps},firmaCoincide:(s.ncSig===nestSig(m))}); })()`, P));

console.log('\nchapa en la línea de tiempo:', await evalInApp(`(()=>{ const e=document.querySelector('.clip .cnc');
  return JSON.stringify(e?{texto:e.textContent.trim(),rojo:e.classList.contains('stale'),titulo:(e.getAttribute('title')||'').slice(0,70)}:null); })()`, P));

console.log('\nquitar el caché:', await evalInApp(`(async()=>{ const m=mediaById(window._NEST);
  ncDetach(m,false); await new Promise(r=>setTimeout(r,400));
  const r={ncPath:m.ncPath,ready:!!m.ncReady,usable:ncUsable(m),decod:collectDrawnVideoClips(state.clips,state.lanes,0.5,0,[]).length,
           chapa:!!document.querySelector('.clip .cnc')};
  return JSON.stringify(Object.assign(r,{veredicto:(!r.ncPath&&!r.usable&&r.decod===6&&!r.chapa)?'CORRECTO: vuelve al comportamiento de siempre':'REVISAR'}),null,1); })()`, P));
