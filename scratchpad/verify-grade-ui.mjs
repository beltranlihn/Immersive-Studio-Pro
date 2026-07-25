import { evalInApp } from './cdp.mjs';
const expr = `(()=>{
  const out={};
  // build a minimal mid-gray image media + clip
  const cv=document.createElement('canvas'); cv.width=64; cv.height=64; const cx=cv.getContext('2d'); cx.fillStyle='#808080'; cx.fillRect(0,0,64,64);
  const m={id:uid(),name:'grade-test',kind:'image',el:cv,originalEl:cv,tex:newTex(),w:64,h:64,dur:5,fps:0,thumb:cv.toDataURL(),color:clipColorFor('image')};
  upTex(m.tex,cv); state.media.push(m);
  addClip(m,0,0);
  const c=state.clips[state.clips.length-1]; state.selId=c.id; state.selIds=[c.id]; state.selLane=null; renderInspector();
  // expand Color section if collapsed so #colorRows is populated (renderInspector builds it regardless)
  out.wheels = document.querySelectorAll('#colorRows .cwheel').length;
  out.masters = document.querySelectorAll('#colorRows .cwm').length;
  // simulate a wheel edit programmatically → prop should be a fresh array (no shared ref)
  c.props.cgGain=[0.3,0.6,0.2]; renderInspector();
  const wl=document.querySelector('#colorRows .cwheel[data-k=cgGain] .cwh');
  out.handlePlaced = wl ? {left:wl.style.left, top:wl.style.top} : null;
  out.propKept = JSON.stringify(c.props.cgGain);
  return JSON.stringify(out,null,1);
})()`;
console.log(await evalInApp(expr, { timeout: 15000 }));
