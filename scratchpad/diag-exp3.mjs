import { evalInApp } from './cdp.mjs';
console.log(await evalInApp(`(()=>{
  const vi=[..._vinst.entries()].map(([id,v])=>({clip:id, src:(v.vsrc||'').split('/').pop().slice(0,26),
    ready:v.ready, readyState:v.vel?v.vel.readyState:null, ct:v.vel?+v.vel.currentTime.toFixed(2):null,
    dur:v.vel?(isFinite(v.vel.duration)?+v.vel.duration.toFixed(2):'?'):null,
    err:v.vel&&v.vel.error?v.vel.error.code:null, seeking:v.vel?v.vel.seeking:null,
    cd:!!v.cd, cdPending:!!v.cdPending }));
  const drawn=collectDrawnVideoClips(state.clips,state.lanes,0,0,[]).map(x=>({clip:x.c.id,medio:x.m.name,local:+x.local.toFixed(2),tieneSrcUrl:!!x.m.srcUrl}));
  return JSON.stringify({ instancias:vi, dibujados:drawn, exportQuality:_exportQuality,
    wcDecode:state.view.wcDecode, useProxy:state.view.useProxy }, null, 1);
})()`, { port: 9222 }));
