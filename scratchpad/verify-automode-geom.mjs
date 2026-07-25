import { evalInApp } from './cdp.mjs';
const expr = `(()=>{
  const c=state.clips[state.clips.length-1]; const cd=c&&[...document.querySelectorAll('#tracks .clip')].find(x=>+x.dataset.clip===c.id);
  if(!cd) return JSON.stringify({err:'no clip'});
  const hdL=cd.querySelector('.hd.l'), hdR=cd.querySelector('.hd.r'), canv=cd.querySelector('canvas.clipautocv');
  const R=e=>{ const r=e.getBoundingClientRect(); return {top:Math.round(r.top),bottom:Math.round(r.bottom),h:Math.round(r.height)}; };
  const hl=R(hdL), hr=R(hdR), cvr=R(canv), cdr=R(cd);
  // in automode: handle bottom must sit at/above the canvas top (no vertical overlap with the point area)
  const noOverlapL = hl.bottom <= cvr.top + 1;
  const noOverlapR = hr.bottom <= cvr.top + 1;
  // and the canvas must cover the FULL width incl. edges: its left ≈ clip left, right ≈ clip right
  const cdrect=cd.getBoundingClientRect(), cvrect=canv.getBoundingClientRect();
  const coversEdges = (cvrect.left <= cdrect.left+2) && (cvrect.right >= cdrect.right-2);
  return JSON.stringify({ automode:document.body.classList.contains('automode'),
    handleL:hl, handleR:hr, canvas:cvr, clip:cdr,
    PASS_handleAboveCanvas_L: noOverlapL, PASS_handleAboveCanvas_R: noOverlapR,
    PASS_canvasCoversEdges: coversEdges,
    canvasLeftVsClip:[Math.round(cvrect.left),Math.round(cdrect.left)], canvasRightVsClip:[Math.round(cvrect.right),Math.round(cdrect.right)] },null,1);
})()`;
console.log(await evalInApp(expr, { timeout: 15000 }));
