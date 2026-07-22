import { evalInApp } from './cdp.mjs';

const CLIP = 'C:\\\\Users\\\\beltr\\\\Desktop\\\\Alma Digital Studio\\\\Projects\\\\Immersive Studio Pro\\\\scratchpad\\\\dm_hevc_fast.mp4';

// ClipDecoder under test (uses the app's global demuxMP4). Decode-ahead ring cache + frameAt + seek reset.
const ENGINE = `
function makeClipDecoder(d){
  const N=d.samples.length;
  const order=Array.from({length:N},(_,i)=>i).sort((a,b)=>d.samples[a].pts-d.samples[b].pts);
  const dispPts=order.map(i=>d.samples[i].pts);
  const frameDur=Math.max(1,Math.round(1e6/(d.fps||30)));
  const AHEAD=18*frameDur, BEHIND=4*frameDur, CAP=48, GOP_SKIP=90;
  const keyBefore=(di)=>{ for(let i=di;i>=0;i--)if(d.samples[i].key)return i; return 0; };
  const decIdxForTime=(t)=>{ let lo=0,hi=N-1,res=0; while(lo<=hi){const m=(lo+hi)>>1; if(dispPts[m]<=t){res=m;lo=m+1;}else hi=m-1;} return order[res]; };
  const cache=new Map(); let dec=null, feed=0, feedBase=0, lastFedPts=-1, closed=false, targetUs=0, err=null, peak=0, prevT=0;
  const mkDec=()=>{ dec=new VideoDecoder({output:f=>{ if(closed){f.close();return;} const o=cache.get(f.timestamp); if(o&&o!==f)o.close(); cache.set(f.timestamp,f); if(cache.size>peak)peak=cache.size; }, error:e=>{err=String(e&&e.message||e);}}); dec.configure({codec:d.codec,description:d.description}); };
  const resetTo=(di)=>{ if(dec){try{dec.close();}catch(e){}} for(const[,f]of cache)f.close(); cache.clear(); mkDec(); feed=keyBefore(di); feedBase=feed; lastFedPts=-1; err=null; };
  const evict=()=>{ const lo=targetUs-BEHIND; for(const[ts,f]of cache){ if(ts<lo){f.close();cache.delete(ts);} }
    if(cache.size>CAP){ const ks=[...cache.keys()].sort((a,b)=>a-b); for(const k of ks){ if(cache.size<=CAP)break; if(k<targetUs-frameDur){cache.get(k).close();cache.delete(k);} } } };
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  (async function pump(){ while(!closed){
    try{
      const tgtDec=decIdxForTime(targetUs);
      const back=targetUs<prevT-frameDur; // moved backward → a seek, not forward playback
      if(!dec){ resetTo(tgtDec); }
      else if((tgtDec-feed)>GOP_SKIP){ resetTo(tgtDec); }  // big forward jump: skip the gap, restart at keyframe
      else if(back||feedBase>tgtDec){ let have=false; for(const ts of cache.keys()){ if(ts<=targetUs&&ts>=targetUs-2*frameDur){have=true;break;} } if(!have)resetTo(tgtDec); } // backward seek: reset only if the frame isn't still cached
      prevT=targetUs;
      if(feed<N && dec.decodeQueueSize<8 && (lastFedPts<0 || lastFedPts<targetUs+AHEAD)){
        const s=d.samples[feed]; const data=await d.readSample(feed); if(closed)break;
        try{ dec.decode(new EncodedVideoChunk({type:s.key?'key':'delta',timestamp:s.pts,data})); }catch(e){ err=String(e); }
        lastFedPts=s.pts; feed++;
      } else { await delay(2); }
      evict();
    }catch(e){ err=String(e); await delay(20); }
  } })();
  return {
    setTarget:(t)=>{ targetUs=t; },
    frameAt:(t)=>{ let best=-1; for(const ts of cache.keys()){ if(ts<=t&&ts>best)best=ts; } return best>=0?cache.get(best):null; },
    stats:()=>({cache:cache.size, peak, feed, err}),
    close:()=>{ closed=true; if(dec){try{dec.close();}catch(e){}} for(const[,f]of cache)f.close(); cache.clear(); d.close(); }
  };
}
`;

const expr = `(async()=>{
  ${ENGINE}
  const path=${JSON.stringify(CLIP)};
  const w=(ms)=>new Promise(r=>setTimeout(r,ms));
  // 4 concurrent decoders on the SAME source at different in-points (the room case)
  const decs=[]; for(let n=0;n<4;n++){ const d=await demuxMP4(path); decs.push(makeClipDecoder(d)); }
  const clipLen=5000000; const offs=[0,1000000,2000000,3000000];
  for(let j=0;j<4;j++)decs[j].setTarget(offs[j]); // prime at each decoder's start point
  await w(500); // prime
  // drive ~60fps for 3.5s, sample sync
  const res=decs.map(()=>({ticks:0,hits:0,lagSum:0,lagMax:0}));
  const t0=performance.now();
  while(performance.now()-t0<3500){
    const el=(performance.now()-t0)*1000; // us
    for(let j=0;j<4;j++){ const tgt=((el+offs[j])%clipLen); decs[j].setTarget(tgt);
      const f=decs[j].frameAt(tgt); const r=res[j]; r.ticks++;
      if(f){ r.hits++; const lag=Math.abs(f.timestamp-tgt)/1000; r.lagSum+=lag; if(lag>r.lagMax)r.lagMax=lag; } }
    await w(16);
  }
  // SEEK test on decoder 0: jump to 4.5s then 0.4s, allow prime, check
  decs[0].setTarget(4500000); await w(250); const s1=!!decs[0].frameAt(4500000);
  decs[0].setTarget(400000);  await w(250); const f2=decs[0].frameAt(400000); const s2=!!f2 && Math.abs(f2.timestamp-400000)/1000<80;
  const report=res.map((r,j)=>({dec:j, hitRate:+(100*r.hits/r.ticks).toFixed(1)+'%', avgLagMs:+(r.lagSum/Math.max(1,r.hits)).toFixed(1), maxLagMs:+r.lagMax.toFixed(1), peak:decs[j].stats().peak, err:decs[j].stats().err}));
  for(const d of decs)d.close();
  return JSON.stringify({perDecoder:report, seekForward:s1, seekBackward:s2},null,1);
})()`;

try { console.log(await evalInApp(expr, { timeout: 60000 })); }
catch (e) { console.error('ERROR:', e.message); process.exit(1); }
