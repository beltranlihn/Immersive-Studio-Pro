import { evalInApp } from './cdp.mjs';
const expr = `(()=>{
  const out={};
  out.removed = { autoRecOn:(typeof autoRecOn), toggleAutoRec:(typeof toggleAutoRec), recWrite:(typeof recWrite), bakeRecorded:(typeof bakeRecorded), setAutoOff:(typeof setAutoOff), reenableAll:(typeof reenableAll), reenableAuto:(typeof reenableAuto), anyOverride:(typeof anyOverride), updReEnableGlobal:(typeof updReEnableGlobal) };
  out.autoRecBtn = !!document.getElementById('autoRecBtn');
  out.stateAutoRec = ('autoRec' in state);
  out.kept = { manualEdit:(typeof manualEdit), returnToDefault:(typeof returnToDefault), evalP:(typeof evalP), setKf:(typeof setKf), drawAutoCurve:(typeof drawAutoCurve), pause:(typeof pause) };
  try{ if(typeof hideLanding==='function')hideLanding(); }catch(_){}
  { const lo=document.getElementById('landingOv'); if(lo)lo.remove(); const s=document.getElementById('splashOv'); if(s)s.remove(); }
  const cv=document.createElement('canvas'); cv.width=cv.height=64; const cx=cv.getContext('2d'); cx.fillStyle='#808080'; cx.fillRect(0,0,64,64);
  const m={id:uid(),name:'ct',kind:'image',el:cv,originalEl:cv,tex:newTex(),w:64,h:64,dur:6,fps:0,thumb:cv.toDataURL(),color:clipColorFor('image')};
  upTex(m.tex,cv); state.media.push(m); if(state.lanes[0])state.lanes[0].h=90; addClip(m,0,0.5);
  const c=state.clips[state.clips.length-1]; state.selId=c.id; state.selIds=[c.id];
  setKf(c,'opacity',c.start,0,'linear'); setKf(c,'opacity',c.start+3,100,'linear');
  out.evalMid = Math.round(evalP(c,'opacity',c.start+1.5));
  out.hasKf = !!hasKf(c,'opacity');
  state.playhead=c.start+2; const before=(c.kf.opacity||[]).length; manualEdit(c,'opacity',77); const after=(c.kf.opacity||[]).length;
  out.manualEditWrites = after>=before; out.manualEditVal = Math.round(evalP(c,'opacity',c.start+2));
  let rtdErr=null; try{ returnToDefault(c); }catch(e){ rtdErr=e.message; } out.returnToDefaultOK = !rtdErr && !hasKf(c,'opacity'); out.rtdErr=rtdErr;
  let drawErr=null; try{ openAuto(c,'opacity'); renderTimeline(); render(); }catch(e){ drawErr=e.message; } out.renderOK=!drawErr; out.drawErr=drawErr;
  return JSON.stringify(out,null,1);
})()`;
console.log(await evalInApp(expr,{timeout:15000}));
