import { evalInApp } from './cdp.mjs';
const expr = `(()=>{
  const ov=[...document.querySelectorAll('.overlay')].map(o=>{ const cs=getComputedStyle(o); const r=o.getBoundingClientRect();
    return { cls:o.className, pe:cs.pointerEvents, z:cs.zIndex, pos:cs.position, rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)], parent:o.parentElement&&o.parentElement.className }; });
  // also: what does elementsFromPoint (plural) return over a clip edge?
  const c=state.clips[state.clips.length-1]; const cd=c&&[...document.querySelectorAll('#tracks .clip')].find(x=>+x.dataset.clip===c.id);
  let stack=null;
  if(cd){ const r=cd.getBoundingClientRect(); stack=document.elementsFromPoint(r.left+3, r.top+r.height/2).slice(0,6).map(e=>e.className+' {pe:'+getComputedStyle(e).pointerEvents+',z:'+getComputedStyle(e).zIndex+'}'); }
  return JSON.stringify({overlays:ov, stackAtEdgeMid:stack},null,1);
})()`;
console.log(await evalInApp(expr, { timeout: 15000 }));
