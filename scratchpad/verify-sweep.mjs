import { evalInApp } from './cdp.mjs';
const expr = `(()=>{
  const out={};
  try{ if(typeof hideLanding==='function')hideLanding(); }catch(_){}
  { for(const id of ['landingOv','splashOv','loadingOv']){const e=document.getElementById(id); if(e)e.remove();} }
  const cv=document.createElement('canvas'); cv.width=cv.height=64; const cx=cv.getContext('2d'); cx.fillStyle='#808080'; cx.fillRect(0,0,64,64);
  const m={id:uid(),name:'sw',kind:'image',el:cv,originalEl:cv,tex:newTex(),w:64,h:64,dur:6,fps:0,thumb:cv.toDataURL(),color:clipColorFor('image')};
  upTex(m.tex,cv); state.media.push(m); if(state.lanes[0])state.lanes[0].h=90; addClip(m,0,0.5);
  const c=state.clips[state.clips.length-1]; state.selId=c.id; state.selIds=[c.id];
  // automation curve + enter automation view; drawAutoCurve must render without error and produce a non-empty canvas
  setKf(c,'opacity',c.start,0,'linear'); setKf(c,'opacity',c.start+3,100,'linear');
  out.evalMid=Math.round(evalP(c,'opacity',c.start+1.5)); // 50
  let err=null; try{ openAuto(c,'opacity'); renderTimeline(); render(); }catch(e){ err=e.message; }
  out.renderErr=err;
  // the clip automation canvas draws pixels (non-blank)
  const canv=[...document.querySelectorAll('#tracks .clip')].map(cd=>cd.querySelector('canvas.clipautocv')).find(Boolean);
  let painted=false; if(canv){ try{ const g=canv.getContext('2d'); const d=g.getImageData(0,0,Math.min(canv.width,40),Math.min(canv.height,40)).data; for(let i=3;i<d.length;i+=4){ if(d[i]>0){painted=true;break;} } }catch(e){ out.pxErr=e.message; } }
  out.autoCanvasPainted=painted;
  // sepAuto (clone) still works without _autoOff
  let sepErr=null; try{ const n={}; sepAuto(n,c); }catch(e){ sepErr=e.message; } out.sepAutoOK=!sepErr; out.sepErr=sepErr;
  // manualEdit still writes keyframe
  state.playhead=c.start+2; const b=(c.kf.opacity||[]).length; manualEdit(c,'opacity',77); out.manualEditVal=Math.round(evalP(c,'opacity',c.start+2)); out.manualEditWrote=(c.kf.opacity||[]).length>=b;
  return JSON.stringify(out,null,1);
})()`;
console.log(await evalInApp(expr,{timeout:15000}));
