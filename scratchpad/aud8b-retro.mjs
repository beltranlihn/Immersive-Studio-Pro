// [AUD 2026-08b] COMPATIBILIDAD HACIA ATRAS: un .isp guardado por el build NUEVO (con srcIn/srcOut en los medios)
// abierto en la app VIEJA (a33c70b, :9223). El campo nuevo debe entrar como equipaje inerte y nada mas.
import { evalInApp } from './cdp.mjs';
const DIR = String.raw`C:\Users\beltr\Desktop\Alma Digital Studio\Projects\Immersive Studio Pro\scratchpad`;
const ISP = (DIR + '\\aud8b-viejo-resave.isp').replace(/\\/g, '\\\\');
const port = +(process.argv[2] || 9223);
const r = await evalInApp(`(async function(){
  state.dirty=false; try{clearLiveAutosaves();}catch(e){}
  await openProjectPath('${ISP}',true);
  { const o=document.querySelector('#confirmOv'); if(o){ const b=[...o.querySelectorAll('button')].find(x=>/Open the file/.test(x.textContent)); if(b)b.click(); } }
  const t0=Date.now(); while(Date.now()-t0<20000){ await new Promise(r=>setTimeout(r,250)); if(state.media.filter(m=>!isSeqMedia(m)).every(m=>!m._loading))break; }
  return { alerta:(document.querySelector('#alertOv')||{textContent:null}).textContent,
    clips:state.clips.length, media:state.media.length,
    ausentes:state.media.filter(m=>m.missing&&!isSeqMedia(m)).length,
    bucles:state.clips.filter(c=>c.loop).map(c=>c.name+':'+(+(+c.loopLen).toFixed(2))),
    marcasInertes:state.media.filter(m=>m.srcIn!=null&&m.srcIn!==undefined).length,
    comps:state.media.filter(m=>m.kind==='nest'&&m.comp).map(m=>m.name+':'+(m.comp.mediaIds||[]).join(',')) };
})()`, { port, timeout: 60000 });
console.log(JSON.stringify(r, null, 1));
