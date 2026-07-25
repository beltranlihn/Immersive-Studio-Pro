import { evalInApp } from './cdp.mjs';
const expr = `(()=>{
  const R=sel=>{ const e=document.querySelector(sel); if(!e)return null; const r=e.getBoundingClientRect(); return {w:Math.round(r.width),h:Math.round(r.height),l:Math.round(r.left),t:Math.round(r.top)}; };
  const vis=sel=>{ const e=document.querySelector(sel); return e?getComputedStyle(e).display!=='none':null; };
  const snap=()=>({ seqMode:state.seqMode, viewMode:state.view.mode,
    topbar:R('.top'), viewCtl:R('#viewCtl')||R('.viewctl'), stage:R('#stage'), glc:R('#gl'),
    mediaPane:R('#mediaPane'), inspPane:R('#inspPane'), trackHdr:R('#trackHdr'), toolRail:R('#toolRail'), transport:R('.transport'), editseg:R('.editseg'),
    btns:{ b3d:vis('#viewModeSeg button[data-v="3d"]'), horizon:vis('#dispSeg button[data-d="hfade"]'), threeSeg:vis('#threeModeSeg'), azel:vis('#azelReadout'), fov:vis('#fovCtl') } });
  const out={ current:snap() };
  // flip compositing mode flags + refresh mode UI, measure again (no real sequence swap — just the UI response)
  const savedMode=state.seqMode;
  try{ state.seqMode='flat'; updModeUI(); resize(); out.asFlat=snap(); }catch(e){ out.flatErr=String(e); }
  try{ state.seqMode='room'; updModeUI(); resize(); out.asRoom=snap(); }catch(e){ out.roomErr=String(e); }
  try{ state.seqMode=savedMode; updModeUI(); resize(); }catch(e){}
  return JSON.stringify(out,null,1);
})()`;
console.log(await evalInApp(expr,{timeout:15000}));
