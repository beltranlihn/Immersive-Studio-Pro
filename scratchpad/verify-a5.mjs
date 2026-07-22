import { evalInApp } from './cdp.mjs';
const expr = `(()=>{
  // fresh: one shape clip on a video lane, select it
  createShapeClip('rect');
  const c = state.clips[state.clips.length-1];
  const li = c.lane;
  state.selId=c.id; state.selIds=[c.id];
  state.playhead = c.start + 1;
  // automate 'size' then 'az' — the OLD behaviour stacked a 2nd lane below; NEW keeps one
  setKf(c,'size',c.start+0.5,50,'linear'); setKf(c,'size',c.start+2,120,'linear');
  setKf(c,'az',c.start+0.5,10,'linear');   setKf(c,'az',c.start+2,90,'linear');
  showAutomation(c);
  renderTimeline();
  const lane = state.lanes[li];
  const addBtns = document.querySelectorAll('#trackHdr .autoctl .abt[data-a=add], #trackHdr .autohdr .abt[data-a=add]').length;
  const subLanes = document.querySelectorAll('#tracks .autolane').length;
  const subHdrs  = document.querySelectorAll('#trackHdr .autohdr').length;
  const headerChoosers = document.querySelectorAll('#trackHdr .autoctl').length;
  const clipOverlay = document.querySelectorAll('.clipautocv').length;
  // switch the single overlay to 'az' by setting _autoP (what the header chooser does)
  lane._autoP='az'; renderTimeline();
  const afterSwitch = { autoP: lane._autoP, subLanes: document.querySelectorAll('#tracks .autolane').length };
  return JSON.stringify({
    autoP: lane._autoP,
    lane_auto: lane._auto || null,
    addLaneButtons: addBtns,
    stackedSubLanes: subLanes,
    stackedSubHeaders: subHdrs,
    headerChoosers,
    clipOverlayCanvases: clipOverlay,
    afterSwitch,
    appendAutoLanesIsNoop: (function(){ let n=0; const t=document.createElement('div'),h=document.createElement('div'); lane._auto=['opacity','size']; appendAutoLanes(li,500,t,h); n=t.children.length+h.children.length; lane._auto=[]; return n===0; })()
  }, null, 1);
})()`;
console.log(await evalInApp(expr, { timeout: 20000 }));
