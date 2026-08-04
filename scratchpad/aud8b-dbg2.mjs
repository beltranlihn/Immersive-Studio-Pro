import { evalInApp } from './cdp.mjs';
const port = +(process.argv[2] || 9223);
const r = await evalInApp(`(async function(){
  state.playhead=101.3; _previewClock=0;
  render(); await new Promise(r=>requestAnimationFrame(r));
  render(); await new Promise(r=>requestAnimationFrame(r));
  // pantalla
  const cv=document.createElement('canvas'); cv.width=cv.height=256; const g=cv.getContext('2d');
  g.drawImage(glc,0,0,glc.width,glc.height,0,0,256,256);
  const id=g.getImageData(0,0,256,256).data; let nzScr=0;
  for(let i=0;i<id.length;i+=4){ if(id[i]>8||id[i+1]>8||id[i+2]>8)nzScr++; }
  // FBO
  gl.bindFramebuffer(gl.FRAMEBUFFER,compFBO); composite(101.3,null,false,true);
  const buf=new Uint8Array(compW*compH*4); gl.readPixels(0,0,compW,compH,gl.RGBA,gl.UNSIGNED_BYTE,buf);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  let nzF=0; for(let i=0;i<buf.length;i+=4){ if(buf[i]|buf[i+1]|buf[i+2])nzF++; }
  const ck=state.clips.find(c=>c.name==='c_kf');
  return { nzScr, nzF, compW, compH,
    ckSize:ck&&evalP(ck,'size',101.3), ckOp:ck&&evalR(ck,'opacity',101.3),
    fill:compFillVp?compFillVp():null, seqWH:[state.seqW,state.seqH] };
})()`, { port, timeout: 60000 });
console.log(JSON.stringify(r));
