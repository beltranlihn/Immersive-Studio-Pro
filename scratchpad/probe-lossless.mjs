// ¿Podemos hacer SIN PÉRDIDA dentro de la app, sin FFmpeg? (modo cuantizador de WebCodecs)
// Y si no: ¿cuánto se pierde de verdad a los bitrates que ya usamos?
import { evalInApp } from './cdp.mjs';

const expr = `(async()=>{
  const out={};
  const sup=async(cfg)=>{ try{ const s=await VideoEncoder.isConfigSupported(cfg); return !!(s&&s.supported);}catch(e){return 'err: '+e.message;} };
  // 1) ¿acepta el modo cuantizador? (la puerta al sin-pérdida en el propio codificador)
  out.quantizer={};
  for(const [n,c] of [['vp9','vp09.00.62.08'],['vp9_10b','vp09.02.62.10'],['av1','av01.0.13M.08'],['h264','avc1.64003e']]){
    out.quantizer[n+'_4096']= await sup({codec:c,width:4096,height:4096,bitrate:200e6,framerate:60,bitrateMode:'quantizer'});
    out.quantizer[n+'_1024']= await sup({codec:c,width:1024,height:1024,bitrate:50e6,framerate:60,bitrateMode:'quantizer'});
  }
  // 2) PRUEBA REAL de fidelidad: patrón exigente → codificar → decodificar → comparar píxel a píxel.
  //    A 1024² para que sea rápido; la conclusión sobre 4:2:0 vs 4:4:4 no depende del tamaño.
  const S=1024;
  const cv=document.createElement('canvas'); cv.width=S; cv.height=S; const cx=cv.getContext('2d',{willReadFrequently:true});
  // material duro: degradado suave (bandas) + bordes de color saturado (croma) + ruido fino (detalle)
  const g=cx.createLinearGradient(0,0,S,0); g.addColorStop(0,'#101828'); g.addColorStop(1,'#2a3f6a'); cx.fillStyle=g; cx.fillRect(0,0,S,S);
  cx.fillStyle='#ff2020'; cx.fillRect(0,0,S/3,S/2); cx.fillStyle='#20ff40'; cx.fillRect(S/3,0,S/3,S/2);
  cx.fillStyle='#ffffff'; cx.font='bold 90px sans-serif'; cx.fillText('DOMO 4096',30,S*0.72);
  { const im=cx.getImageData(0,S*0.8,S,S*0.2); for(let i=0;i<im.data.length;i+=4){ const n=(Math.random()-0.5)*70; im.data[i]=Math.max(0,Math.min(255,im.data[i]+n)); im.data[i+1]=Math.max(0,Math.min(255,im.data[i+1]+n)); im.data[i+2]=Math.max(0,Math.min(255,im.data[i+2]+n)); } cx.putImageData(im,0,S*0.8); }
  const ref=cx.getImageData(0,0,S,S).data;

  const roundTrip=async(codec,cfgExtra,label)=>{
    const chunks=[]; let encErr=null;
    let enc; try{ enc=new VideoEncoder({output:c=>{ const b=new Uint8Array(c.byteLength); c.copyTo(b); chunks.push({b,type:c.type,ts:c.timestamp}); },error:e=>{encErr=String(e.message||e);}}); }catch(e){ return {label,ROTO:String(e)}; }
    try{ enc.configure(Object.assign({codec,width:S,height:S,framerate:60,latencyMode:'quality'},cfgExtra)); }catch(e){ return {label,ROTO:'configure: '+e.message}; }
    for(let i=0;i<3;i++){ const vf=new VideoFrame(cv,{timestamp:i*16666,duration:16666}); try{ enc.encode(vf,{keyFrame:true}); }catch(e){ encErr=e.message; } vf.close(); }
    try{ await enc.flush(); }catch(e){ encErr=encErr||e.message; } try{ enc.close(); }catch(e){}
    if(encErr) return {label,err:encErr};
    if(!chunks.length) return {label,err:'sin datos'};
    // decodificar el primer fotograma y comparar
    let got=null,decErr=null;
    const dec=new VideoDecoder({output:f=>{ if(!got)got=f; else f.close(); },error:e=>{decErr=String(e.message||e);}});
    try{ dec.configure({codec}); }catch(e){ return {label,err:'decoder: '+e.message}; }
    try{ dec.decode(new EncodedVideoChunk({type:chunks[0].type,timestamp:chunks[0].ts,data:chunks[0].b})); await dec.flush(); }catch(e){ decErr=decErr||e.message; }
    try{ dec.close(); }catch(e){}
    if(!got) return {label,err:'no decodificó '+(decErr||'')};
    const c2=document.createElement('canvas'); c2.width=S;c2.height=S; const x2=c2.getContext('2d',{willReadFrequently:true});
    x2.drawImage(got,0,0); got.close();
    const d=x2.getImageData(0,0,S,S).data;
    let se=0,maxd=0,ndif=0;
    for(let i=0;i<d.length;i+=4){ for(let k=0;k<3;k++){ const e=d[i+k]-ref[i+k]; if(e){ndif++;} se+=e*e; if(Math.abs(e)>maxd)maxd=Math.abs(e); } }
    const n=(d.length/4)*3, mse=se/n;
    const bytes=chunks[0].b.length;
    return { label, sinPerdida:(maxd===0), psnr:mse>0?+(10*Math.log10(255*255/mse)).toFixed(2):'∞', errorMax:maxd,
             subpixelesDistintos:+(ndif/n*100).toFixed(1)+'%', KBporFotograma:Math.round(bytes/1024) };
  };

  out.fidelidad=[];
  out.fidelidad.push(await roundTrip('vp09.00.62.08',{bitrate:200e6},'VP9 8b @200Mbps (bitrate)'));
  out.fidelidad.push(await roundTrip('vp09.02.62.10',{bitrate:200e6},'VP9 10b @200Mbps (bitrate)'));
  out.fidelidad.push(await roundTrip('av01.0.13M.08',{bitrate:200e6},'AV1 @200Mbps (bitrate)'));
  out.fidelidad.push(await roundTrip('avc1.64003e',{bitrate:200e6},'H.264 @200Mbps (bitrate)'));
  // modos cuantizador, si los acepta
  for(const [c,l] of [['vp09.00.62.08','VP9 8b q=0'],['av01.0.13M.08','AV1 q=0']]){
    if(await sup({codec:c,width:S,height:S,bitrate:100e6,framerate:60,bitrateMode:'quantizer'}))
      out.fidelidad.push(await roundTrip(c,{bitrate:100e6,bitrateMode:'quantizer'},l));
    else out.fidelidad.push({label:l,err:'modo cuantizador no aceptado'});
  }
  return JSON.stringify(out,null,1);
})()`;

console.log(await evalInApp(expr, { port: 9222, timeout: 900000 }));
