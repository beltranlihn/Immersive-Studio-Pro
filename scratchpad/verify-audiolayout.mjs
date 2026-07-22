import { evalInApp } from './cdp.mjs';
const expr = `(()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  // ensure at least one audio lane
  if(!state.lanes.some(l=>l.kind==='audio')){ state.lanes.push({id:uid(),name:'Audio 1',tag:'A1',kind:'audio'}); state.lanes.push({id:uid(),name:'Audio 2',tag:'A2',kind:'audio'}); }
  state.tl.audioCollapsed=false; renderTimeline();
  const dvs=[...document.querySelectorAll('#trackHdr .trackdivider.hdr')].map(d=>({lab:(d.querySelector('.dvlab')||{}).textContent, h:d.getBoundingClientRect().height, chev:(d.querySelector('.dvchev')||{}).textContent||null}));
  const audLanes=[...document.querySelectorAll('#tracks .audiozone .lane')].map(l=>Math.round(l.getBoundingClientRect().height));
  const vidLanes=[...document.querySelectorAll('#tracks > .lane')].map(l=>Math.round(l.getBoundingClientRect().height)).filter(h=>h>0);
  const az=document.querySelector('#tracks .audiozone'); const azH=az?Math.round(az.getBoundingClientRect().height):null;
  const audHdr=document.querySelector('#audioHeadZone .lanehdr.aud'); const hasRes=audHdr?!!audHdr.querySelector('.laneres'):null; const resVis=audHdr&&audHdr.querySelector('.laneres')?getComputedStyle(audHdr.querySelector('.laneres')).display:'(none-el)';
  // collapse
  state.tl.audioCollapsed=true; renderTimeline();
  const azCollapsed=Math.round((document.querySelector('#tracks .audiozone')||{getBoundingClientRect:()=>({height:0})}).getBoundingClientRect().height);
  const audLanesCollapsed=[...document.querySelectorAll('#tracks .audiozone .lane')].length;
  state.tl.audioCollapsed=false; renderTimeline();
  return JSON.stringify({ dividers:dvs, audioLaneHeights:audLanes, videoLaneHeights:vidLanes, audioZoneHeight:azH, audioResizeDisplay:resVis, collapsed:{azHeight:azCollapsed, audioRows:audLanesCollapsed} }, null, 1);
})()`;
console.log(await evalInApp(expr, { timeout: 20000 }));
