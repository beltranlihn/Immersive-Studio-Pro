import { evalInApp } from './cdp.mjs';
console.log(await evalInApp(`(async()=>{
  const ovs=[...document.querySelectorAll('.overlay')].map(o=>(o.textContent||'').replace(/\\s+/g,' ').slice(0,220));
  const m=(typeof window._NEST!=='undefined')?mediaById(window._NEST):null;
  let files=[]; try{ const L=await DSP.listDir('C:\\\\Users\\\\beltr\\\\AppData\\\\Local\\\\Temp\\\\claude\\\\nc-test\\\\nest proxies'); for(const f of (L||[]))files.push((f.name||f)+' '+(f.size!=null?Math.round(f.size/1e6)+'MB':'')); }catch(e){ files=['listDir: '+e.message]; }
  return JSON.stringify({ overlays:ovs, nest:m?{name:m.name,ncPath:m.ncPath,ncReady:!!m.ncReady,ncStale:!!m.ncStale,dur:m.dur,lanes:(m.nestLanes||[]).length,clips:(m.nestClips||[]).length}:null,
    archivos:files, seqActiva:(activeSeq()||{}).name, status:(document.getElementById('statusMsg')||{}).textContent },null,1);
})()`, { port: 9222 }));
