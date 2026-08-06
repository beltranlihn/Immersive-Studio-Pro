// [R223] evidencia VISUAL del cross dissolve: A solo · mitad del crossfade · B solo
import { fn, shot, errs, close } from './lib.mjs';
const out = {};

out.build = await fn(`
  const mA=state.media.find(m=>m.name==='Multimedia2.mp4'), mB=state.media.find(m=>m.name==='Multimedia3.mp4');
  state.clips=[]; state.markers=[]; state.selId=null; state.selIds=[];
  // makeClip = props COMPLETAS (opacity incluida). Un objeto a mano sin opacity sale negro: evalR devuelve undefined.
  const mk=(m,start,dur,inP,name)=>{ const c=makeClip(m,0,start,{size:90}); c.dur=dur; c.inP=inP; c.name=name; state.clips.push(c); return c; };
  const A=mk(mA,0,6,2,'A'), B=mk(mB,6,6,3,'B');
  clearAllUndo(); renderTimeline(); render();
  // crossfade manual de 2s: arrastrar el handle fadeIn de B sobre el corte
  state.selId=B.id; state.selIds=[B.id]; renderTimeline();
  await __dragFade(B.id,'fadeIn',-2.0);
  const ov=__ovl(0);
  return {ov, A:{start:A.start,dur:A.dur}, B:{start:+B.start.toFixed(3),dur:+B.dur.toFixed(3),inP:+B.inP.toFixed(3)},
    ids:{A:A.id,B:B.id}};
`, 120000);

const at = async (t, name) => {
  const r = await fn(`state.playhead=${t}; await scrubRender(); render(); await new Promise(r=>setTimeout(r,400)); render();
    return {t:state.playhead, draw:compositeClips(state.playhead).map(x=>({name:x.c.name,xf:+x.xf.toFixed(3)}))};`, 120000);
  const p = await shot(name);
  return { ...r, shot: name };
};
out.soloA   = await at(2.0, 'r223-6.5-dissolve-a-solo-A');
out.xf25    = await at(4.5, 'r223-6.5-dissolve-b-25pct');
out.xf50    = await at(5.0, 'r223-6.5-dissolve-c-50pct');
out.xf75    = await at(5.5, 'r223-6.5-dissolve-d-75pct');
out.soloB   = await at(8.0, 'r223-6.5-dissolve-e-solo-B');

console.log(JSON.stringify(out, null, 2));
console.log('ERRS', JSON.stringify(await errs()));
close();
