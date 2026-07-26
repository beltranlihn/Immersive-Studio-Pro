// 2ª vuelta: ¿de verdad no hay HEVC? ¿AV1/VP9 son por hardware? ¿a qué velocidad codifican 4096²?
import { evalInApp } from './cdp.mjs';

const expr = `(async()=>{
  const out={};
  // 1) las funciones REALES de la app
  out.pickHevc_4096 = await pickHevcCodec(4096,4096,180e6,60);
  out.pickHevc_1920 = await pickHevcCodec(1920,1080,20e6,60);
  out.pickAvc_4096  = await pickAvcCodec(4096,4096,180e6,60);
  out.pickAvc_3072  = await pickAvcCodec(3072,3072,120e6,60);
  out.pickAvc_1920  = await pickAvcCodec(1920,1080,20e6,60);

  // 2) ¿hardware o software?
  const hw=async(codec,w,h,acc)=>{ try{ const s=await VideoEncoder.isConfigSupported({codec,width:w,height:h,bitrate:200e6,framerate:60,hardwareAcceleration:acc}); return !!(s&&s.supported);}catch(e){return 'err';} };
  out.accel={};
  for(const [n,c] of [['av1','av01.0.13M.08'],['vp9','vp09.00.62.08'],['vp9_10bit','vp09.02.62.10']]){
    out.accel[n]={ hardware: await hw(c,4096,4096,'prefer-hardware'), software: await hw(c,4096,4096,'prefer-software'), any: await hw(c,4096,4096,'no-preference') };
  }
  // límite exacto de H.264
  out.avcLimit=[];
  for(const s of [3072,3200,3456,3584,3840,4096]){ const c=await pickAvcCodec(s,s,150e6,60); out.avcLimit.push(s+'²:'+(c||'NO')); }
  // 3) BENCHMARK real: 24 frames 4096² desde un canvas
  const bench=async(codec,extra)=>{
    const cv=document.createElement('canvas'); cv.width=4096; cv.height=4096; const cx=cv.getContext('2d');
    const g=cx.createLinearGradient(0,0,4096,4096); g.addColorStop(0,'#12306a'); g.addColorStop(.5,'#c04010'); g.addColorStop(1,'#f0e0a0'); cx.fillStyle=g; cx.fillRect(0,0,4096,4096);
    let bytes=0,err=null,n=0;
    let enc; try{ enc=new VideoEncoder({output:c=>{bytes+=c.byteLength;n++;},error:e=>{err=String(e&&e.message||e);}}); }catch(e){ return {ROTO:String(e)}; }
    try{ enc.configure(Object.assign({codec,width:4096,height:4096,bitrate:250e6,framerate:60,latencyMode:'quality'},extra||{})); }catch(e){ return {ROTO:'configure '+String(e)}; }
    const t0=performance.now(); const N=24;
    for(let i=0;i<N&&!err;i++){ cx.fillStyle='rgba(255,255,255,0.02)'; cx.fillRect((i*97)%3000,0,600,4096);
      const vf=new VideoFrame(cv,{timestamp:Math.round(i*1e6/60),duration:Math.round(1e6/60)});
      try{ enc.encode(vf,{keyFrame:i===0}); }catch(e){ err=String(e); }
      vf.close();
      while(enc.encodeQueueSize>4&&!err) await new Promise(r=>setTimeout(r,0)); }
    try{ await enc.flush(); }catch(e){ err=err||String(e); }
    const ms=performance.now()-t0; try{ enc.close(); }catch(e){}
    return { err, frames:n, msPorFrame:Math.round(ms/N), fps:+(N/(ms/1000)).toFixed(2), MBporSeg:+((bytes*60/N)/1e6).toFixed(1) };
  };
  out.bench={};
  out.bench.av1 = await bench('av01.0.13M.08');
  out.bench.vp9 = await bench('vp09.00.62.08');
  out.bench.vp9_10bit = await bench('vp09.02.62.10');
  out.bench.h264_3072 = await (async()=>{ // referencia de velocidad a 3072²
    return null; })();
  return JSON.stringify(out,null,1);
})()`;

console.log(await evalInApp(expr, { port: 9222, timeout: 600000 }));
