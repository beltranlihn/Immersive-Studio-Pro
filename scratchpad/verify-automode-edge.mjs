import { evalInApp } from './cdp.mjs';
const expr = `(()=>{
  const out={};
  try{ if(typeof hideLanding==='function')hideLanding(); }catch(_){}
  { const lo=document.getElementById('landingOv'); if(lo)lo.remove(); const li=document.getElementById('loadingOv'); if(li)li.remove(); }
  // make a gray image clip on a tall lane
  const cv=document.createElement('canvas'); cv.width=64; cv.height=64; const cx=cv.getContext('2d'); cx.fillStyle='#808080'; cx.fillRect(0,0,64,64);
  const m={id:uid(),name:'edge-test',kind:'image',el:cv,originalEl:cv,tex:newTex(),w:64,h:64,dur:6,fps:0,thumb:cv.toDataURL(),color:clipColorFor('image')};
  upTex(m.tex,cv); state.media.push(m);
  if(state.lanes[0]) state.lanes[0].h=90;
  addClip(m,0,0.5);
  const c=state.clips[state.clips.length-1]; state.selId=c.id; state.selIds=[c.id];
  openAuto(c,'opacity');        // enter automation mode + arm a param → clip automation canvas appears
  renderTimeline();
  out.automode = document.body.classList.contains('automode');
  const cd=[...document.querySelectorAll('#tracks .clip')].find(x=>+x.dataset.clip===c.id);
  if(!cd) return JSON.stringify({err:'no clip el'});
  const hd=cd.querySelector('.hd.l'); const canv=cd.querySelector('canvas.clipautocv');
  out.hasCanvas = !!canv;
  // computed height of the L handle in automode (should be ~15px, not full clip height)
  const hdH = hd ? getComputedStyle(hd).height : null;
  const cdH = getComputedStyle(cd).height;
  out.hdHeight = hdH; out.clipHeight = cdH;
  out.hdIsTopStrip = hd ? (parseFloat(hdH) <= 16) : null;
  // elementFromPoint at the LEFT edge, BELOW the top strip (mid clip) → must be the automation canvas, not the resize handle
  const r=cd.getBoundingClientRect();
  const midEl = document.elementFromPoint(r.left+3, r.top+ (parseFloat(cdH)/2));
  const topEl = document.elementFromPoint(r.left+3, r.top+4);
  out.edgeMid_isCanvas = !!(midEl && midEl.classList && midEl.classList.contains('clipautocv'));
  out.edgeMid_cls = midEl ? midEl.className : null;
  out.edgeTop_isHandle = !!(topEl && topEl.classList && topEl.classList.contains('hd'));
  out.edgeTop_cls = topEl ? topEl.className : null;
  return JSON.stringify(out,null,1);
})()`;
console.log(await evalInApp(expr, { timeout: 15000 }));
