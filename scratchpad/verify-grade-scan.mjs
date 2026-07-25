import { evalInApp } from './cdp.mjs';
const expr = `(()=>{
  const c=state.clips[state.clips.length-1]; if(!c)return JSON.stringify({err:'no clip'});
  state.playhead=0.1;
  const m=mediaById(c.mediaId);
  // ensure the media texture is fresh
  if(m&&m.el&&m.tex)upTex(m.tex,m.el);
  gl.bindFramebuffer(gl.FRAMEBUFFER,compFBO); composite(state.playhead,COMP,false);
  const px=new Uint8Array(COMP*COMP*4); gl.readPixels(0,0,COMP,COMP,gl.RGBA,gl.UNSIGNED_BYTE,px);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  let cov=0,minx=COMP,maxx=0,miny=COMP,maxy=0,rsum=0;
  for(let y=0;y<COMP;y+=8)for(let x=0;x<COMP;x+=8){ const i=(y*COMP+x)*4; if(px[i+3]>8){ cov++; rsum+=px[i]; if(x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; if(y>maxy)maxy=y; } }
  return JSON.stringify({ clip:{mediaId:c.mediaId, warp:c.props.warp, size:c.props.size, az:c.props.az, el:c.props.el}, seqMode:state.seqMode, viewMode:state.view.mode,
    mediaOK: !!(m&&m.tex), covSamples:cov, bbox:[minx,miny,maxx,maxy], avgR: cov?Math.round(rsum/cov):0 },null,1);
})()`;
console.log(await evalInApp(expr, { timeout: 20000 }));
