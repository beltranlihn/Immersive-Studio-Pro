import { evalInApp } from './cdp.mjs';

// Project is already loaded from measure-room. Test how presented-fps scales with 1 vs 2 vs 4 active decoders.
const expr = `(async()=>{
  const w=(ms)=>new Promise(r=>setTimeout(r,ms));
  const all=state.clips.slice(); if(all.length<4) return 'need 4 clips, have '+all.length;
  const out=[];
  async function trial(n){
    state.clips=all.slice(0,n); reconcileVinst(); renderTimeline();
    state.playhead=Math.min(480, duration()-15);
    if(!state.playing)play(); await w(1600); // warm
    const q=()=>[..._vinst.entries()].filter(([id])=>state.clips.some(c=>c.id===id)).map(([id,vi])=>{ const v=vi.vel; let pq={}; try{pq=v.getVideoPlaybackQuality();}catch(e){} return {rs:v.readyState,total:pq.totalVideoFrames||0}; });
    const b=q(); const t0=performance.now(); await w(3000); const dt=(performance.now()-t0)/1000; const a=q();
    pause();
    let pres=0; for(let i=0;i<a.length;i++)pres+=(a[i].total-(b[i]?b[i].total:a[i].total));
    const perDec=a.map((x,i)=>({rs:x.rs, fps:+(((x.total-(b[i]?b[i].total:x.total)))/dt).toFixed(1)}));
    out.push({decoders:n, totalPresFps:+(pres/dt).toFixed(1), perDec});
    await w(400);
  }
  await trial(1); await trial(2); await trial(4);
  state.clips=all; reconcileVinst(); renderTimeline();
  return JSON.stringify(out,null,1);
})()`;

try { console.log(await evalInApp(expr, { timeout: 90000 })); }
catch (e) { console.error('ERROR:', e.message); process.exit(1); }
