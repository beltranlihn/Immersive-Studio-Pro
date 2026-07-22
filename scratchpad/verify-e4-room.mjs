import { evalInApp } from './cdp.mjs';
const ISP = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\Rito Movie\\\\360\\\\Rito360.isp';

const expr = `(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms)); const R={};
  document.querySelectorAll('.overlay').forEach(o=>o.remove());
  try{ const txt=await DSP.readText(${JSON.stringify(ISP)}); loadProject(JSON.parse(txt)); }catch(e){ return 'loadErr '+e.message; }
  const vid=()=>state.media.find(m=>m.kind==='video');
  for(let i=0;i<50;i++){ const m=vid(); if(m&&m.srcUrl)break; await w(400); }
  const m=vid(); R.media={name:m&&m.name, proxyReady:!!(m&&m.proxyReady)};
  state.view.wcDecode=true; // [E7] enable WebCodecs decode for this test
  state.view.mode='3d'; state.playhead=Math.min(500, duration()-15);
  const _r=window.render; let rn=0; window.render=function(){ rn++; return _r.apply(this,arguments); };
  if(!state.playing)play(); await w(2500); // warm: let the 4 ClipDecoders demux + prime
  const snap=()=>[..._vinst.entries()].map(([id,vi])=>({id, hasCD:!!vi.cd, pending:!!vi.cdPending, st:vi.cd?vi.cd.stats():null}));
  const before=snap(); const rn0=rn; const t0=performance.now();
  await w(4000);
  const dt=(performance.now()-t0)/1000; const after=snap();
  pause(); window.render=_r;
  R.renderFps=+((rn-rn0)/dt).toFixed(1);
  R.nInst=after.length;
  R.perClip=after.map(a=>{ const b=before.find(x=>x.id===a.id)||{}; const fb=(b.st&&b.st.feed)||0, fa=(a.st&&a.st.feed)||0;
    return { path:a.hasCD?'ClipDecoder':(a.pending?'CD(pending)':'<video>'), feedFps:+(((fa-fb))/dt).toFixed(1), st:a.st }; });
  return JSON.stringify(R,null,1);
})()`;
try { console.log(await evalInApp(expr, { timeout: 90000 })); }
catch (e) { console.error('ERROR:', e.message); process.exit(1); }
