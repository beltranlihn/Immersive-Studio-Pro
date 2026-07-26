import { evalInApp } from './cdp.mjs';
console.log(await evalInApp(`(async()=>{
  const m=mediaById(window._N);
  const c=state.clips.find(x=>x.mediaId===m.id);
  let st=null; try{ st=await DSP.stat(m.ncPath||''); }catch(e){}
  return JSON.stringify({ nc:{path:(m.ncPath||'').split('\\').pop(),MB:st?+(st.size/1e6).toFixed(2):null,ready:!!m.ncReady,stale:!!m.ncStale,dim:m.ncW+'x'+m.ncH},
    usable:ncUsable(m), decod:collectDrawnVideoClips(state.clips,state.lanes,1.0,0,[]).length,
    overlays:[...document.querySelectorAll('.overlay')].length },null,1);
})()`,{port:9222}));
