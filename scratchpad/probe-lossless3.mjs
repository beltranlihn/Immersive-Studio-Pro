// Uno por uno, con relanzado entre medias: así una caída se le puede achacar a alguien.
import { targets } from './cdp.mjs';
import { spawn } from 'child_process';
const wait = ms => new Promise(r => setTimeout(r, ms));
const ROOT = 'C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro';

async function conApp(fn) {
  const p = spawn(ROOT + '\\node_modules\\electron\\dist\\electron.exe', ['.', '--remote-debugging-port=9223'], { cwd: ROOT, detached: false, stdio: 'ignore' });
  let idx = null;
  for (let i = 0; i < 200; i++) { const l = await targets(9223).catch(() => []); idx = l.find(t => t.type === 'page' && /index\.html/.test(t.url || '') && t.webSocketDebuggerUrl); if (idx) break; await wait(200); }
  if (!idx) { try { p.kill(); } catch (_) {} return { ROTO: 'no arrancó' }; }
  const ws = new WebSocket(idx.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws')); });
  let _id = 0;
  const send = (m, pr) => new Promise((res, rej) => { const id = ++_id; const h = ev => { const x = JSON.parse(ev.data); if (x.id !== id) return; ws.removeEventListener('message', h); x.error ? rej(new Error(JSON.stringify(x.error))) : res(x.result); }; ws.addEventListener('message', h); ws.send(JSON.stringify({ id, method: m, params: pr })); });
  const evl = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true, timeout: 240000 }); if (r.exceptionDetails) return { ROTO: JSON.stringify(r.exceptionDetails).slice(0, 300) }; return r.result.value; };
  for (let i = 0; i < 90; i++) { if (await evl('typeof state!=="undefined"') === true) break; await wait(300); }
  let out;
  try { out = await fn(evl); } catch (e) { out = { CAIDA: String(e.message).slice(0, 140) }; }
  try { ws.close(); } catch (_) {}
  try { p.kill('SIGKILL'); } catch (_) {}
  await wait(1500);
  return out;
}

const PREP = `
  const S=512;
  const cv=document.createElement('canvas'); cv.width=S; cv.height=S; const cx=cv.getContext('2d',{willReadFrequently:true});
  const g=cx.createLinearGradient(0,0,S,0); g.addColorStop(0,'#101828'); g.addColorStop(1,'#2a3f6a'); cx.fillStyle=g; cx.fillRect(0,0,S,S);
  cx.fillStyle='#ff2020'; cx.fillRect(0,0,S/3,S/2); cx.fillStyle='#20ff40'; cx.fillRect(S/3,0,S/3,S/2);
  cx.fillStyle='#fff'; cx.font='bold 46px sans-serif'; cx.fillText('DOMO',20,S*0.72);
  { const im=cx.getImageData(0,S*0.8,S,S*0.2); for(let i=0;i<im.data.length;i+=4){ const n=(Math.random()-0.5)*70; for(let k=0;k<3;k++) im.data[i+k]=Math.max(0,Math.min(255,im.data[i+k]+n)); } cx.putImageData(im,0,S*0.8); }
  const ref=cx.getImageData(0,0,S,S).data;
  const rt=async(label,codec,cfgExtra,encOpt)=>{
    const chunks=[]; let err=null; let enc;
    try{ enc=new VideoEncoder({output:c=>{ const b=new Uint8Array(c.byteLength); c.copyTo(b); chunks.push({b,type:c.type,ts:c.timestamp}); },error:e=>{err=String(e.message||e);}}); }catch(e){ return {label,no:String(e).slice(0,100)}; }
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
    if(!got) return {label,no:'no decodificó: '+String(de).slice(0,70)};
    const fmt=got.format;
    const c2=document.createElement('canvas'); c2.width=S;c2.height=S; const x2=c2.getContext('2d',{willReadFrequently:true});
    x2.drawImage(got,0,0); got.close();
    const d=x2.getImageData(0,0,S,S).data;
    let se=0,mx=0; for(let i=0;i<d.length;i+=4)for(let k=0;k<3;k++){ const e=d[i+k]-ref[i+k]; se+=e*e; if(Math.abs(e)>mx)mx=Math.abs(e); }
    let se2=0,n2=0,mx2=0;
    for(let y=Math.floor(S*0.55);y<Math.floor(S*0.78);y++)for(let x=0;x<S;x++){ const i=(y*S+x)*4;
      for(let k=0;k<3;k++){ const e=d[i+k]-ref[i+k]; se2+=e*e; n2++; if(Math.abs(e)>mx2)mx2=Math.abs(e); } }
    const n=(d.length/4)*3, mse=se/n, mse2=se2/n2;
    return { label, formato:fmt, bitExacto:(mx===0),
             psnrGlobal:mse>0?+(10*Math.log10(65025/mse)).toFixed(1):'INF', errMaxGlobal:mx,
             psnrDegradado:mse2>0?+(10*Math.log10(65025/mse2)).toFixed(1):'INF', errMaxDegradado:mx2,
             KB:Math.round(chunks[0].b.length/1024) };
  };
`;

const CASOS = [
  ['VP9 4:2:0 · 500 Mbps',      `rt('x','vp09.00.62.08',{bitrate:500e6})`],
  ['VP9 4:2:0 · cuantiz. 0',    `rt('x','vp09.00.62.08',{bitrate:100e6,bitrateMode:'quantizer'},{vp9:{quantizer:0}})`],
  ['AV1 4:2:0 · cuantiz. 0',    `rt('x','av01.0.13M.08',{bitrate:100e6,bitrateMode:'quantizer'},{av1:{quantizer:0}})`],
  ['VP9 4:4:4 (prof1) · 500Mbps',`rt('x','vp09.01.62.08',{bitrate:500e6})`],
  ['VP9 4:4:4 (prof1) · cuant.0',`rt('x','vp09.01.62.08',{bitrate:100e6,bitrateMode:'quantizer'},{vp9:{quantizer:0}})`],
  ['AV1 4:4:4 (prof1) · cuant.0',`rt('x','av01.1.13M.08',{bitrate:100e6,bitrateMode:'quantizer'},{av1:{quantizer:0}})`],
];

console.log('soporte declarado de perfiles 4:4:4:');
console.log(JSON.stringify(await conApp(async evl => await evl(`(async()=>{
  const sup=async(c,w)=>{ try{ const s=await VideoEncoder.isConfigSupported({codec:c,width:w,height:w,bitrate:200e6,framerate:60}); return !!(s&&s.supported);}catch(e){return false;} };
  const r={}; for(const [n,c] of [['VP9 prof1 444 8b','vp09.01.62.08'],['VP9 prof3 444 10b','vp09.03.62.10'],['AV1 prof1 444','av01.1.13M.08'],['AV1 prof2 444','av01.2.13M.08'],['H264 High444','avc1.f4001e']])
    r[n]={ '512':await sup(c,512), '4096':await sup(c,4096) };
  return JSON.stringify(r);
})()`)), null, 1));

for (const [nombre, expr] of CASOS) {
  const r = await conApp(async evl => await evl(`(async()=>{ ${PREP} const r=await ${expr}; r.label=${JSON.stringify(nombre)}; return JSON.stringify(r); })()`));
  console.log('\n' + nombre + ':\n  ' + (typeof r === 'string' ? r : JSON.stringify(r)));
}
