import { evalInApp } from './cdp.mjs';
const expr = `(()=>{
  const c=state.clips[state.clips.length-1]; if(!c)return JSON.stringify({err:'no clip'});
  state.playhead=0.1; const m=mediaById(c.mediaId); if(m&&m.el&&m.tex)upTex(m.tex,m.el);
  const X=760,Y=160,W=520,H=440; // inside the clip bbox found by the scan
  const readAvg=()=>{ gl.bindFramebuffer(gl.FRAMEBUFFER,compFBO); composite(state.playhead,COMP,false);
    const px=new Uint8Array(W*H*4); gl.readPixels(X,Y,W,H,gl.RGBA,gl.UNSIGNED_BYTE,px); gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    let sr=0,sg=0,sb=0,cov=0; for(let i=0;i<px.length;i+=4){ if(px[i+3]>8){ sr+=px[i]; sg+=px[i+1]; sb+=px[i+2]; cov++; } }
    return cov?{r:sr/cov,g:sg/cov,b:sb/cov,cov}:{r:0,g:0,b:0,cov:0}; };
  c.props.cgGain=[0,0,0]; c.props.cgLift=[0,0,0]; c.props.cgGamma=[0,0,0]; const neutral=readAvg();
  c.props.cgGain=[0,0,0.7]; const brighter=readAvg();
  c.props.cgGain=[0,0,-0.7]; const darker=readAvg();
  c.props.cgGain=[0,0,0]; c.props.cgLift=[0,1,0]; const redLift=readAvg();     // pure red push
  c.props.cgLift=[0,0,0]; render();
  const rnd=o=>({r:Math.round(o.r),g:Math.round(o.g),b:Math.round(o.b),cov:o.cov});
  return JSON.stringify({ neutral:rnd(neutral), brighter:rnd(brighter), darker:rnd(darker), redLift:rnd(redLift),
    PASS_brighter: brighter.r>neutral.r+10,
    PASS_darker: darker.r<neutral.r-10,
    PASS_redPush: (redLift.r>neutral.r+8) && (redLift.g<neutral.g-5) && (redLift.b<neutral.b-5) },null,1);
})()`;
console.log(await evalInApp(expr, { timeout: 20000 }));
