import { evalInApp } from './cdp.mjs';
const expr = `(()=>{
  const out={};
  try{ if(typeof hideLanding==='function')hideLanding(); }catch(_){}
  { const lo=document.getElementById('landingOv'); if(lo)lo.remove(); }
  // locations
  out.locs={curve:LW.curve!=null,hasCurve:LW.hasCurve!=null};
  // engine: build a luma curve that maps 0.5→0.8 (points [0,0],[0.5,0.8],[1,1]); check the 256-LUT alpha at idx 128
  const cvSet={l:[[0,0],[0.5,0.8],[1,1]],r:[[0,0],[1,1]],g:[[0,0],[1,1]],b:[[0,0],[1,1]]};
  const data=buildCurveData(cvSet);
  out.lutAt128={R:data[128*4],G:data[128*4+1],B:data[128*4+2],A:data[128*4+3]}; // A(luma) should be ~0.8*255=204
  out.identityFlag=curveIsIdentity({l:[[0,0],[1,1]],r:[[0,0],[1,1]],g:[[0,0],[1,1]],b:[[0,0],[1,1]]});
  out.nonIdentityFlag=curveIsIdentity(cvSet);
  // set up a gray clip
  const cv=document.createElement('canvas'); cv.width=64; cv.height=64; const cx=cv.getContext('2d'); cx.fillStyle='#808080'; cx.fillRect(0,0,64,64);
  const m={id:uid(),name:'curve-test',kind:'image',el:cv,originalEl:cv,tex:newTex(),w:64,h:64,dur:6,fps:0,thumb:cv.toDataURL(),color:clipColorFor('image')};
  upTex(m.tex,cv); state.media.push(m); if(state.lanes[0])state.lanes[0].h=90; addClip(m,0,0.5);
  const c=state.clips[state.clips.length-1]; state.selId=c.id; state.selIds=[c.id]; state.playhead=0.8;
  // sample a block inside the clip bbox (same region as F2 test) with identity vs luma-lift curve
  const X=760,Y=160,W=520,H=440;
  const readAvg=()=>{ gl.bindFramebuffer(gl.FRAMEBUFFER,compFBO); composite(state.playhead,COMP,false);
    const px=new Uint8Array(W*H*4); gl.readPixels(X,Y,W,H,gl.RGBA,gl.UNSIGNED_BYTE,px); gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    let s=0,n=0; for(let i=0;i<px.length;i+=4)if(px[i+3]>8){s+=px[i];n++;} return n?Math.round(s/n):0; };
  const neutral=readAvg();
  c.props.curves=JSON.parse(JSON.stringify(cvSet)); markCurveDirty(c);
  const curved=readAvg();
  c.props.curves=null; markCurveDirty(c); render();
  out.px={neutral, curved, PASS: curved>neutral+40}; // 0.5 gray → ~0.8 via the curve
  // UI
  renderInspector();
  out.ui={ canvas:!!document.querySelector('#colorRows .curvecv'), tabs:document.querySelectorAll('#colorRows .ctab').length, reset:!!document.querySelector('#colorRows #curveReset') };
  return JSON.stringify(out,null,1);
})()`;
console.log(await evalInApp(expr, { timeout: 20000 }));
