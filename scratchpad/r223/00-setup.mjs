// [R223] proyecto de pruebas: domo + 2 mp4 REALES con audio, importados por ruta
import { fn, ev, shot, installErrs, errs, close } from './lib.mjs';

const A = 'C:\\\\Users\\\\beltr\\\\Downloads\\\\Multimedia2.mp4';
const B = 'C:\\\\Users\\\\beltr\\\\Downloads\\\\Multimedia3.mp4';

const r = await fn(`
  window.__errs = window.__errs || [];
  // la app arranca ya con un proyecto domo vacío — no se llama newProject (confirmDiscard abriría diálogo)
  hideLanding(); // el launcher es un .overlay: tapa el editor en las capturas y bloquea los atajos de teclado
  // NO vaciar state.media del todo: la secuencia activa es un media 'nest' y serProject v4 guarda los clips DENTRO
  // de él — borrarlo deja el proyecto sin nada que serializar (guardar+reabrir devolvía 0 clips).
  state.media = state.media.filter(m=>isSeqMedia(m));
  state.clips = []; state.markers = [];
  state.selId=null; state.selIds=[]; state.selLane=null; state.selMarkerId=null; state.selGroupId=null;
  const mA = await addVideoFromPath('${A}', 'Multimedia2.mp4');
  const mB = await addVideoFromPath('${B}', 'Multimedia3.mp4');
  if(!mA||!mB) return {err:'import failed', mA:!!mA, mB:!!mB};
  // esperar a que el audio linkeado (armMediaAudio) se enganche
  for(let i=0;i<80 && !(mA.buffer && mB.buffer); i++) await new Promise(r=>setTimeout(r,150));
  renderMedia(); renderTimeline(); render();
  return {
    media: state.media.map(m=>({id:m.id,name:m.name,kind:m.kind,dur:+(m.dur||0).toFixed(3),w:m.w,h:m.h,hasBuffer:!!m.buffer})),
    lanes: state.lanes.map(l=>({tag:l.tag,kind:l.kind})),
    seqMode: state.seqMode,
    hasNewFns: {cutOverlapsOnDrop: typeof cutOverlapsOnDrop==='function', crossfadeNeighbor: typeof crossfadeNeighbor==='function', _cutEdgeTo: typeof _cutEdgeTo==='function', _dropClip: typeof _dropClip==='function'}
  };
`, 180000);
console.log(JSON.stringify(r, null, 2));
await installErrs();
console.log('errs', JSON.stringify(await errs()));
console.log(await shot('r223-00-setup'));
close();
