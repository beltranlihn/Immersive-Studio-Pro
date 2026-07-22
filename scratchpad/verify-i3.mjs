import { evalInApp } from './cdp.mjs';
const expr = `(async()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  // fresh flat sequence so we composite rectangularly and can read pixels predictably
  createShapeClip('rect');
  const c = state.clips[state.clips.length-1];
  const mm = mediaById(c.mediaId); if(mm){ mm.fill='#ffffff'; renderShapeMedia(mm); }
  state.selId=c.id; state.selIds=[c.id]; state.playhead=c.start+0.5;
  c.props.opacity=100; c.props.size=200; // big so it fills a lot of the dome
  // add a small centered square pen mask
  c.penMasks=[{pts:[[0.42,0.42],[0.58,0.42],[0.58,0.58],[0.42,0.58]],feather:0,invert:false,on:true}];
  rasterizePenMasks(c);
  const maskApplied = (c.props.mask==='pen') && !!c.maskTex;
  render(); await wait(60);
  // read the composite FBO / gl canvas center vs corner
  const glc = document.getElementById('gl');
  const g = glc.getContext('webgl2') || glc.getContext('webgl');
  const W=glc.width, H=glc.height;
  const px=(x,y)=>{ const p=new Uint8Array(4); g.readPixels(x, H-1-y, 1,1, g.RGBA, g.UNSIGNED_BYTE, p); return [p[0],p[1],p[2],p[3]]; };
  const center = px(Math.floor(W/2), Math.floor(H/2));
  const near = px(Math.floor(W*0.30), Math.floor(H/2)); // outside the small centered mask, inside the dome disc
  // now invert and re-read: center should drop, near should rise
  c.penMasks[0].invert=true; rasterizePenMasks(c); render(); await wait(60);
  const centerInv = px(Math.floor(W/2), Math.floor(H/2));
  const nearInv = px(Math.floor(W*0.30), Math.floor(H/2));
  return JSON.stringify({ maskApplied, maskIdxPen: (typeof MASK_IDX!=='undefined'?MASK_IDX.pen:null),
    center_normal:center, near_normal:near, center_inverted:centerInv, near_inverted:nearInv,
    penMaskActive: penMaskActive(c) }, null, 1);
})()`;
console.log(await evalInApp(expr, { timeout: 25000 }));
