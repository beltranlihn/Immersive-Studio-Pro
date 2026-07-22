import { evalInApp } from './cdp.mjs';
const expr = `(()=>{
  createShapeClip('rect'); const c=state.clips[state.clips.length-1];
  state.selId=c.id; state.selIds=[c.id];
  // put a 2-point curve on 'az' at t=0.5 and 1.5
  setKf(c,'az',c.start+0.5,10,'linear'); setKf(c,'az',c.start+1.5,80,'linear');
  copyAutoCurve(c,'az');                 // → state.kfClipboard (relative times 0 and 1)
  clearKf(c,'az');                       // start clean
  // hover a lane at absolute time c.start+3, playhead far away at c.start+0.2
  state.playhead=c.start+0.2;
  state.hoverAuto={cid:c.id,p:'az',cv:null,t:c.start+3};
  // fire the real Ctrl+V keydown
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'v',ctrlKey:true,bubbles:true}));
  const ks=(c.kf&&c.kf.az)?c.kf.az.map(k=>Math.round(k.t*100)/100):[];
  return JSON.stringify({
    clipboardLen: state.kfClipboard&&state.kfClipboard.ks?state.kfClipboard.ks.length:0,
    pastedTimes: ks,
    pastedAtCursorNotPlayhead: ks.length>0 && Math.min(...ks)>2.5   // landed near t=3 (cursor), not near 0.2 (playhead)
  },null,1);
})()`;
console.log(await evalInApp(expr, { timeout: 15000 }));
