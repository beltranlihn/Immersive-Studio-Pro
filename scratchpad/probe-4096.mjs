// ¿Qué acepta ESTA GPU al codificar 4096×4096? (y al decodificar el resultado)
import { evalInApp } from './cdp.mjs';

const expr = `(async()=>{
  const R=[];
  const sizes=[[4096,4096],[3840,3840],[3072,3072],[2048,2048],[8192,8192]];
  const cands=[
    ['H.264 High',        'avc1.640034'],
    ['H.264 High L6.2',   'avc1.64003e'],
    ['HEVC Main  L6.2',   'hvc1.1.6.L186.B0'],
    ['HEVC Main  L5.1',   'hvc1.1.6.L153.B0'],
    ['HEVC Main10 L6.2',  'hvc1.2.4.L186.B0'],
    ['HEVC Main10 L5.1',  'hvc1.2.4.L153.B0'],
    ['HEVC RExt 4:4:4',   'hvc1.4.10.L186.B0'],
    ['AV1',               'av01.0.13M.08'],
    ['AV1 10-bit',        'av01.0.13M.10'],
    ['VP9 profile0',      'vp09.00.62.08'],
    ['VP9 profile2 10b',  'vp09.02.62.10'],
  ];
  for(const [w,h] of sizes){
    const row={size:w+'x'+h, ok:[]};
    for(const [name,codec] of cands){
      try{ const s=await VideoEncoder.isConfigSupported({codec,width:w,height:h,bitrate:200e6,framerate:60});
        if(s&&s.supported) row.ok.push(name); }catch(e){}
    }
    R.push(row);
  }
  // ¿alpha? ¿bitrateMode constant? ¿contentHint?
  let extra={};
  try{ const s=await VideoEncoder.isConfigSupported({codec:'hvc1.1.6.L186.B0',width:4096,height:4096,bitrate:400e6,framerate:60,bitrateMode:'quantizer'}); extra.hevcQuantizer=!!(s&&s.supported); }catch(e){ extra.hevcQuantizer='err'; }
  try{ const s=await VideoEncoder.isConfigSupported({codec:'hvc1.1.6.L186.B0',width:4096,height:4096,bitrate:400e6,framerate:60,hardwareAcceleration:'prefer-software'}); extra.hevcSoftware=!!(s&&s.supported); }catch(e){ extra.hevcSoftware='err'; }
  try{ const s=await VideoEncoder.isConfigSupported({codec:'avc1.640034',width:4096,height:4096,bitrate:200e6,framerate:60,hardwareAcceleration:'prefer-software'}); extra.h264Software=!!(s&&s.supported); }catch(e){ extra.h264Software='err'; }
  // DECODE de vuelta (para reimportar el clip renderizado)
  const dec=[];
  for(const [name,codec] of cands){
    for(const [w,h] of [[4096,4096]]){
      try{ const s=await VideoDecoder.isConfigSupported({codec,codedWidth:w,codedHeight:h}); if(s&&s.supported)dec.push(name); }catch(e){}
    }
  }
  let mc={};
  try{ const d=await navigator.mediaCapabilities.decodingInfo({type:'file',video:{contentType:'video/mp4; codecs="hvc1.1.6.L186.B0"',width:4096,height:4096,bitrate:200e6,framerate:60}}); mc.hevc4096={sup:d.supported,smooth:d.smooth,hw:d.powerEfficient}; }catch(e){ mc.hevc4096='err '+e.message; }
  try{ const d=await navigator.mediaCapabilities.decodingInfo({type:'file',video:{contentType:'video/mp4; codecs="hvc1.2.4.L186.B0"',width:4096,height:4096,bitrate:300e6,framerate:60}}); mc.hevc10_4096={sup:d.supported,smooth:d.smooth,hw:d.powerEfficient}; }catch(e){ mc.hevc10_4096='err'; }
  const glmax=(()=>{ try{ const c=document.createElement('canvas'); const g=c.getContext('webgl2'); return g?g.getParameter(g.MAX_TEXTURE_SIZE):null; }catch(e){ return null; } })();
  return JSON.stringify({encode:R, extra, decode4096:dec, mediaCaps:mc, glMaxTex:glmax, ua:navigator.userAgent.match(/Chrome\\/[0-9.]+/)[0]},null,1);
})()`;

console.log(await evalInApp(expr, { port: 9222 }));
