import { evalInApp } from './cdp.mjs';
const expr = `(async function(){
  // Fabricate a minimal domo sequence with 2 video lanes + 1 audio lane, and fake media (no real decode needed for structural tests)
  window.__errs = window.__errs || [];
  state.media = state.media || [];
  const vm1 = {id:'m_v1', kind:'video', name:'VideoA.mp4', w:1920,h:1080, dur:10, fps:30, path:'C:/fake/VideoA.mp4', thumb:null, buffer:null, proxyReady:false};
  const vm2 = {id:'m_v2', kind:'video', name:'VideoB.mp4', w:1920,h:1080, dur:10, fps:30, path:'C:/fake/VideoB.mp4', thumb:null, buffer:null, proxyReady:false};
  state.media.push(vm1, vm2);
  state.lanes = [
    {id:'lv1', name:'Video 1', tag:'V1', kind:'video'},
    {id:'lv2', name:'Video 2', tag:'V2', kind:'video'},
    {id:'la1', name:'Audio 1', tag:'A1', kind:'audio'},
    {id:'la2', name:'Audio 2', tag:'A2', kind:'audio'}
  ];
  state.clips = [];
  // Linked pair: video clip on lane 0 (V1) + audio clip on lane 2 (A1), both from vm1, linked
  const linkId = uid();
  const cv = {id:uid(), mediaId:'m_v1', lane:0, start:0, dur:4, inP:0, name:'VideoA', color:null, fadeIn:0, fadeOut:0, props:{}, kf:{}, fx:[], link:linkId, avRole:'v'};
  const ca = {id:uid(), mediaId:'m_v1', lane:2, start:0, dur:4, inP:0, name:'VideoA', color:null, fadeIn:0, fadeOut:0, props:{volume:100}, kf:{}, fx:[], link:linkId, avRole:'a'};
  state.clips.push(cv, ca);
  // A second, unlinked video clip on lane 0 right after cv (for overlap/crossfade tests) and an audio clip on lane 2 after ca
  const cv2 = {id:uid(), mediaId:'m_v2', lane:0, start:4, dur:4, inP:0, name:'VideoB', color:null, fadeIn:0, fadeOut:0, props:{}, kf:{}, fx:[]};
  const ca2 = {id:uid(), mediaId:'m_v2', lane:2, start:4, dur:4, inP:0, name:'VideoB-A', color:null, fadeIn:0, fadeOut:0, props:{volume:100}, kf:{}, fx:[]};
  state.clips.push(cv2, ca2);
  state.markers = [];
  state.selId=null; state.selIds=[]; state.selLane=null; state.selMarkerId=null; state.selGroupId=null;
  renderTimeline(); render();
  return {clips: state.clips.map(c=>({id:c.id,lane:c.lane,start:c.start,dur:c.dur,link:c.link,avRole:c.avRole})), lanes: state.lanes.map(l=>l.kind)};
})()`;
evalInApp(expr).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error('ERR',e.message);process.exit(1);});
