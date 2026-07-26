// Corregido: cuantizador POR FOTOGRAMA (así se pide en WebCodecs) y perfiles 4:4:4.
// Pregunta: ¿hay sin-pérdida REAL dentro de la app, sin FFmpeg?
import { evalInApp } from './cdp.mjs';

const expr = `(async()=>{
  const out={};
  const sup=async(cfg)=>{ try{ const s=await VideoEncoder.isConfigSupported(cfg); return !!(s&&s.supported);}catch(e){return false;} };

  // 1) ¿existen los perfiles 4:4:4? (sin 4:4:4 no hay sin-pérdida en RGB, por mucho que el cuantizador sea 0)
  out.perfiles444={};
  const cands444=[['VP9 prof1 4:4:4 8b','vp09.01.62.08'],['VP9 prof3 4:4:4 10b','vp09.03.62.10'],
                  ['AV1 High 4:4:4','av01.1.13M.08'],['AV1 Prof2 4:4:4','av01.2.13M.08'],
                  ['H.264 High 4:4:4','avc1.f4001e']];
  for(const [n,c] of cands444){ out.perfiles444[n]={ '1024':await sup({codec:c,width:1024,height:1024,bitrate:100e6,framerate:60}),
                                                     '4096':await sup({codec:c,width:4096,height:4096,bitrate:300e6,framerate:60}) }; }

  const S=512;
  const cv=document.createElement('canvas'); cv.width=S; cv.height=S; const cx=cv.getContext('2d',{willReadFrequently:true});
  const g=cx.createLinearGradient(0,0,S,0); g.addColorStop(0,'#101828'); g.addColorStop(1,'#2a3f6a'); cx.fillStyle=g; cx.fillRect(0,0,S,S);
  cx.fillStyle='#ff2020'; cx.fillRect(0,0,S/3,S/2); cx.fillStyle='#20ff40'; cx.fillRect(S/3,0,S/3,S/2);
  cx.fillStyle='#fff'; cx.font='bold 46px sans-serif'; cx.fillText('DOMO',20,S*0.72);
  { const im=cx.getImageData(0,S*0.8,S,S*0.2); for(let i=0;i<im.data.length;i+=4){ const n=(Math.random()-0.5)*70; for(let k=0;k<3;k++) im.data[i+k]=Math.max(0,Math.min(255,im.data[i+k]+n)); } cx.putImageData(im,0,S*0.8); }
  const ref=cx.getImageData(0,0,S,S).data;

  const rt=async(label,codec,cfgExtra,encOpt)=>{
    const chunks=[]; let err=null; let enc;
    try{ enc=new VideoEncoder({output:c=>{ const b=new Uint8Array(c.byteLength); c.copyTo(b); chunks.push({b,type:c.type,ts:c.timestamp}); },error:e=>{err=String(e.message||e);}}); }catch(e){ return {label,ROTO:String(e)}; }
    try{ enc.configure(Object.assign({codec,width:S,height:S,framerate:60,latencyMode:'quality'},cfgExtra)); }catch(e){ return {label,no:'configure: '+e.message.slice(0,90)}; }
    for(let i=0;i<2;i++){ const vf=new VideoFrame(cv,{timestamp:i*16666,duration:16666});
      try{ enc.encode(vf,Object.assign({keyFrame:true},encOpt||{})); }catch(e){ err=e.message; } vf.close(); }
    try{ await enc.flush(); }catch(e){ err=err||e.message; } try{ enc.close(); }catch(e){}
    if(err) return {label,no:err.slice(0,110)};
    if(!chunks.length) return {label,no:'sin datos'};
    let got=null,de=null;
    const dec=new VideoDecoder({output:f=>{ if(!got)got=f; else f.close(); },error:e=>{de=String(e.message||e);}});
    try{ dec.configure({codec}); }catch(e){ return {label,no:'decoder: '+e.message.slice(0,80)}; }
    try{ dec.decode(new EncodedVideoChunk({type:chunks[0].type,timestamp:chunks[0].ts,data:chunks[0].b})); await dec.flush(); }catch(e){ de=de||e.message; }
    try{ dec.close(); }catch(e){}
    if(!got) return {label,no:'no decodificó: '+String(de).slice(0,80)};
    const fmt=got.format, csp=got.colorSpace?{m:got.colorSpace.matrix,r:got.colorSpace.fullRange,p:got.colorSpace.primaries}:null;
    const c2=document.createElement('canvas'); c2.width=S;c2.height=S; const x2=c2.getContext('2d',{willReadFrequently:true});
    x2.drawImage(got,0,0); got.close();
    const d=x2.getImageData(0,0,S,S).data;
    let se=0,mx=0; for(let i=0;i<d.length;i+=4)for(let k=0;k<3;k++){ const e=d[i+k]-ref[i+k]; se+=e*e; if(Math.abs(e)>mx)mx=Math.abs(e); }
    // sólo el degradado suave (mitad inferior izquierda, sin bordes de croma saturados)
    let se2=0,n2=0,mx2=0;
    for(let y=Math.floor(S*0.55);y<Math.floor(S*0.78);y++)for(let x=0;x<S;x++){ const i=(y*S+x)*4;
      for(let k=0;k<3;k++){ const e=d[i+k]-ref[i+k]; se2+=e*e; n2++; if(Math.abs(e)>mx2)mx2=Math.abs(e); } }
    const n=(d.length/4)*3, mse=se/n, mse2=se2/n2;
    return { label, formatoDecodificado:fmt, color:csp, bitExacto:(mx===0),
             psnrGlobal:mse>0?+(10*Math.log10(65025/mse)).toFixed(1):'∞', errMaxGlobal:mx,
             psnrDegradado:mse2>0?+(10*Math.log10(65025/mse2)).toFixed(1):'∞', errMaxDegradado:mx2,
             KB:Math.round(chunks[0].b.length/1024) };
  };

  out.pruebas=[];
  // referencia del propio round-trip: bitrate absurdo, para ver el suelo que impone 4:2:0 + conversión de color
  out.pruebas.push(await rt('VP9 4:2:0 · bitrate 500 Mbps','vp09.00.62.08',{bitrate:500e6}));
  out.pruebas.push(await rt('VP9 4:2:0 · cuantizador 0','vp09.00.62.08',{bitrate:100e6,bitrateMode:'quantizer'},{vp9:{quantizer:0}}));
  out.pruebas.push(await rt('AV1 4:2:0 · cuantizador 0','av01.0.13M.08',{bitrate:100e6,bitrateMode:'quantizer'},{av1:{quantizer:0}}));
  if(await sup({codec:'vp09.01.62.08',width:S,height:S,bitrate:100e6,framerate:60})){
    out.pruebas.push(await rt('VP9 4:4:4 · bitrate 500 Mbps','vp09.01.62.08',{bitrate:500e6}));
    out.pruebas.push(await rt('VP9 4:4:4 · cuantizador 0','vp09.01.62.08',{bitrate:100e6,bitrateMode:'quantizer'},{vp9:{quantizer:0}}));
  } else out.pruebas.push({label:'VP9 4:4:4',no:'no aceptado por el codificador'});
  if(await sup({codec:'av01.1.13M.08',width:S,height:S,bitrate:100e6,framerate:60})){
    out.pruebas.push(await rt('AV1 4:4:4 · cuantizador 0','av01.1.13M.08',{bitrate:100e6,bitrateMode:'quantizer'},{av1:{quantizer:0}}));
  } else out.pruebas.push({label:'AV1 4:4:4',no:'no aceptado por el codificador'});
  return JSON.stringify(out,null,1);
})()`;

console.log(await evalInApp(expr, { port: 9222, timeout: 900000 }));
