// Prueba de extremo a extremo: ¿podemos MUXAR AV1/VP9 en .mp4 y VOLVER A REPRODUCIRLO?
import { evalInApp } from './cdp.mjs';

const expr = `(async()=>{
  const out={};
  // 0) ¿el muxer local acepta av1/vp9?
  out.muxer={};
  for(const c of ['avc','hevc','vp9','av1']){
    try{ new Mp4Muxer.Muxer({video:{codec:c,width:1024,height:1024},target:new Mp4Muxer.ArrayBufferTarget(),fastStart:'in-memory'}); out.muxer[c]='ok'; }
    catch(e){ out.muxer[c]='NO: '+(e.message||e).slice(0,80); }
  }
  // 1) decodificación por hardware del resultado
  out.decHW={};
  for(const [n,ct] of [['av1','video/mp4; codecs="av01.0.13M.08"'],['vp9','video/mp4; codecs="vp09.00.62.08"'],['vp9_10b','video/mp4; codecs="vp09.02.62.10"']]){
    try{ const d=await navigator.mediaCapabilities.decodingInfo({type:'file',video:{contentType:ct,width:4096,height:4096,bitrate:120e6,framerate:60}}); out.decHW[n]={sup:d.supported,smooth:d.smooth,hw:d.powerEfficient}; }catch(e){ out.decHW[n]='err'; }
  }
  // 2) codificar 30 frames 4096² de RUIDO (contenido realista) → muxear → escribir → reproducir
  const mkNoise=()=>{ const cv=document.createElement('canvas'); cv.width=4096; cv.height=4096; const cx=cv.getContext('2d');
    const img=cx.createImageData(512,512); for(let i=0;i<img.data.length;i+=4){ img.data[i]=Math.random()*255; img.data[i+1]=Math.random()*255; img.data[i+2]=Math.random()*255; img.data[i+3]=255; }
    const tmp=document.createElement('canvas'); tmp.width=512; tmp.height=512; tmp.getContext('2d').putImageData(img,0,0);
    cx.imageSmoothingEnabled=true; cx.drawImage(tmp,0,0,4096,4096); return {cv,cx,tmp}; };

  const run=async(muxCodec,vcodec,br)=>{
    const {cv,cx,tmp}=mkNoise();
    const chunks=[]; const mux=new Mp4Muxer.Muxer({video:{codec:muxCodec,width:4096,height:4096},target:new Mp4Muxer.ArrayBufferTarget(),fastStart:'in-memory'});
    let err=null,n=0;
    const enc=new VideoEncoder({output:(c,m)=>{ try{ mux.addVideoChunk(c,m); n++; }catch(e){ err=err||('mux: '+e.message); } },error:e=>{err=err||('enc: '+(e.message||e));}});
    try{ enc.configure({codec:vcodec,width:4096,height:4096,bitrate:br,framerate:60,latencyMode:'quality'}); }catch(e){ return {ROTO:'configure '+e.message}; }
    const N=30, t0=performance.now();
    for(let i=0;i<N&&!err;i++){
      cx.drawImage(tmp,(i*13)%200,(i*7)%200,4096,4096);
      const vf=new VideoFrame(cv,{timestamp:Math.round(i*1e6/60),duration:Math.round(1e6/60)});
      try{ enc.encode(vf,{keyFrame:i%60===0}); }catch(e){ err='encode '+e.message; }
      vf.close(); while(enc.encodeQueueSize>3&&!err) await new Promise(r=>setTimeout(r,0));
    }
    try{ await enc.flush(); }catch(e){ err=err||('flush '+e.message); }
    try{ enc.close(); }catch(e){}
    const ms=performance.now()-t0;
    if(err) return {err, fps:+(N/(ms/1000)).toFixed(2)};
    try{ mux.finalize(); }catch(e){ return {err:'finalize '+e.message}; }
    const buf=mux.target.buffer;
    // reproducir de vuelta
    const blob=new Blob([buf],{type:'video/mp4'}); const url=URL.createObjectURL(blob);
    const v=document.createElement('video'); v.muted=true; v.src=url;
    const meta=await new Promise(r=>{ let d=false; v.onloadedmetadata=()=>{if(!d){d=true;r({w:v.videoWidth,h:v.videoHeight,dur:+v.duration.toFixed(3)});}}; v.onerror=()=>{if(!d){d=true;r({error:(v.error&&v.error.message)||'load error'});}}; setTimeout(()=>{if(!d){d=true;r({error:'timeout'});}},15000); });
    let pintado=null;
    if(!meta.error){ try{ await new Promise((r,j)=>{ v.currentTime=0.2; v.onseeked=r; setTimeout(r,6000); });
      const c2=document.createElement('canvas'); c2.width=64; c2.height=64; const x2=c2.getContext('2d'); x2.drawImage(v,0,0,64,64);
      const px=x2.getImageData(0,0,64,64).data; let s=0; for(let i=0;i<px.length;i+=4)s+=px[i]+px[i+1]+px[i+2];
      pintado=Math.round(s/(64*64*3)); }catch(e){ pintado='err '+e.message; } }
    URL.revokeObjectURL(url);
    return { frames:n, fpsCodificacion:+(N/(ms/1000)).toFixed(2), MB:+(buf.byteLength/1e6).toFixed(2), MbpsReal:+((buf.byteLength*8*60/N)/1e6).toFixed(1), reproduce:meta, brilloMedio:pintado };
  };
  out.av1  = await run('av1','av01.0.13M.08',150e6);
  out.vp9  = await run('vp9','vp09.00.62.08',150e6);
  out.vp9_10bit = await run('vp9','vp09.02.62.10',150e6);
  return JSON.stringify(out,null,1);
})()`;

console.log(await evalInApp(expr, { port: 9222, timeout: 900000 }));
