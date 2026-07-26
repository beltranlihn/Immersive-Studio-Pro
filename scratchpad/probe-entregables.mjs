// ¿Qué puede entregar un cliente DE VERDAD? Tamaños comerciales reales, no cuadrados de laboratorio.
import { evalInApp } from './cdp.mjs';
const expr = `(async()=>{
  const sizes=[
    ['1080p        1920x1080',1920,1080],
    ['1440p        2560x1440',2560,1440],
    ['4K UHD       3840x2160',3840,2160],
    ['4K DCI       4096x2160',4096,2160],
    ['8K UHD       7680x4320',7680,4320],
    ['domo 2K      2048²',2048,2048],
    ['domo 3K      3072²',3072,3072],
    ['domo 4K      4096²',4096,4096],
    ['domo 6K      6144²',6144,6144],
    ['domo 8K      8192²',8192,8192],
    ['sala 3 muros 5760x1080',5760,1080],
    ['sala 4 muros 15360x2160',15360,2160],
  ];
  const out=[];
  for(const [n,w,h] of sizes){
    const br=Math.max(24,Math.min(800,Math.round(w*h*60*0.11/1e6)))*1e6;
    const r={ formato:n };
    r['H.264'] = await pickAvcCodec(w,h,br,60) ? 'si' : 'NO';
    r['HEVC']  = await pickHevcCodec(w,h,br,60) ? 'si' : 'NO';
    r['AV1']   = await pickAv1Codec(w,h,br,60) ? 'si' : 'NO';
    r['VP9']   = await pickVp9Codec(w,h,br,60,false) ? 'si' : 'NO';
    const glMax=gl.getParameter(gl.MAX_TEXTURE_SIZE)||8192;
    r['PNG/HAP'] = (Math.max(w,h)<=glMax) ? 'si' : 'NO (supera MAX_TEXTURE_SIZE '+glMax+')';
    out.push(r);
  }
  return JSON.stringify({ maxTex:gl.getParameter(gl.MAX_TEXTURE_SIZE), tabla:out },null,1);
})()`;
console.log(await evalInApp(expr, { port: 9222, timeout: 600000 }));
