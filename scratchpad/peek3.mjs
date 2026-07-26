import { evalInApp } from './cdp.mjs';
const expr = `(async()=>{
  const m=mediaById(window._N);
  let st=null; try{ st=await DSP.stat(m.ncPath||''); }catch(e){}
  const nombre=(m.ncPath||'').split(String.fromCharCode(92)).pop();
  return JSON.stringify({ nc:{archivo:nombre, MB:st?+(st.size/1e6).toFixed(2):null, ready:!!m.ncReady, stale:!!m.ncStale, dim:m.ncW+'x'+m.ncH},
    usable:ncUsable(m), decod:collectDrawnVideoClips(state.clips,state.lanes,1.0,0,[]).length,
    overlays:[...document.querySelectorAll('.overlay')].map(o=>(o.textContent||'').replace(/\\s+/g,' ').slice(0,90)) },null,1);
})()`;
console.log(await evalInApp(expr, { port: 9222 }));
