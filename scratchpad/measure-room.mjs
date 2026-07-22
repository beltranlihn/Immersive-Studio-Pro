import { evalInApp } from './cdp.mjs';

const ISP = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\Rito Movie\\\\360\\\\Rito360.isp';

const expr = `(async()=>{
  const w=(ms)=>new Promise(r=>setTimeout(r,ms)); const R={};
  document.querySelectorAll('.overlay').forEach(o=>o.remove()); // kill any autosave/confirm prompt
  try{ const txt=await DSP.readText(${JSON.stringify(ISP)}); loadProject(JSON.parse(txt)); }catch(e){ return 'loadErr '+e.message; }
  const vid=()=>state.media.find(m=>m.kind==='video');
  for(let i=0;i<50;i++){ const m=vid(); if(m&&m.srcUrl)break; await w(400); }
  const m=vid();
  R.seqMode=state.seqMode; R.clips=(state.clips||[]).length;
  await w(1800); // let the proxy auto-heal (k9bhpy delete) settle
  R.media = m?{name:m.name,w:m.w,h:m.h,proxyReady:!!m.proxyReady,uses:(m.proxyReady?'PROXY':'ORIGINAL')}:null;
  state.view.mode='3d';
  state.playhead=Math.min(500, duration()-15);
  const _r=window.render; let rn=0; window.render=function(){ rn++; return _r.apply(this,arguments); };
  if(!state.playing)play(); await w(1500); // warm up decoders
  const q=()=>[..._vinst.entries()].map(([id,vi])=>{ const v=vi.vel; let pq={}; try{pq=v.getVideoPlaybackQuality();}catch(e){}
    return {id,t:v?v.currentTime:-1,vw:v?v.videoWidth:0,rs:v?v.readyState:-1,total:pq.totalVideoFrames||0,dropped:pq.droppedVideoFrames||0}; });
  const before=q(); const rn0=rn; const t0=performance.now();
  await w(4000);
  const dt=(performance.now()-t0)/1000; const after=q();
  pause(); window.render=_r;
  R.renderFps=+((rn-rn0)/dt).toFixed(1);
  R.nDecoders=after.length; R.window=+dt.toFixed(2);
  R.perClip = after.map(a=>{ const b=before.find(x=>x.id===a.id)||a;
    return { src:a.vw>0?(a.vw<=960?'proxy':'ORIG')+' '+a.vw:'?', rs:a.rs,
             ctAdv:+(a.t-b.t).toFixed(2), presFps:+((a.total-b.total)/dt).toFixed(1), dropFps:+((a.dropped-b.dropped)/dt).toFixed(1) }; });
  return JSON.stringify(R,null,1);
})()`;

try { console.log(await evalInApp(expr, { timeout: 90000 })); }
catch (e) { console.error('ERROR:', e.message); process.exit(1); }
