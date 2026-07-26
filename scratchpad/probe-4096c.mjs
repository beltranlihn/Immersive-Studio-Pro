// ¿El "no" del HEVC/H.264 a 4096² es por TAMAÑO o por BITRATE?
import { evalInApp } from './cdp.mjs';

const expr = `(async()=>{
  const out={};
  const test=async(codec,w,h,br,fps)=>{ try{ const s=await VideoEncoder.isConfigSupported({codec,width:w,height:h,bitrate:br,framerate:fps||60}); return !!(s&&s.supported);}catch(e){return 'err';} };
  // HEVC a distintos bitrates y tamaños
  out.hevc={};
  for(const s of [2048,3072,4096]){
    const row={};
    for(const br of [20,40,60,80,100,120,160,181,240,400]) row[br+'Mbps']= await test('hvc1.1.6.L186.B0',s,s,br*1e6);
    out.hevc[s+'²']=row;
  }
  out.h264={};
  for(const s of [3072,3584,4096]){
    const row={};
    for(const br of [20,60,100,160,240]) row[br+'Mbps']= await test('avc1.64003e',s,s,br*1e6);
    out.h264[s+'²']=row;
  }
  // ¿y a 30 fps? (el nivel depende de fps)
  out.hevc4096_30fps={};
  for(const br of [60,100,160,240]) out.hevc4096_30fps[br+'Mbps']= await test('hvc1.1.6.L186.B0',4096,4096,br*1e6,30);
  // ¿hardware?
  for(const acc of ['prefer-hardware','prefer-software']){
    try{ const s=await VideoEncoder.isConfigSupported({codec:'hvc1.1.6.L186.B0',width:4096,height:4096,bitrate:60e6,framerate:60,hardwareAcceleration:acc}); out['hevc4096_'+acc]=!!(s&&s.supported);}catch(e){out['hevc4096_'+acc]='err';}
  }
  // qué devuelve pickHevcCodec con bitrate razonable
  out.pickHevc_4096_60Mbps = await pickHevcCodec(4096,4096,60e6,60);
  out.pickHevc_4096_100Mbps = await pickHevcCodec(4096,4096,100e6,60);
  out.pickHevc_4096_120Mbps = await pickHevcCodec(4096,4096,120e6,60);
  return JSON.stringify(out,null,1);
})()`;

console.log(await evalInApp(expr, { port: 9222, timeout: 600000 }));
