/* [R241·B] Carga creciente sobre la sala real: 1 → 2 → 3 → 4 capas simultáneas de HEVC 7196×912 @60fps
   (hasta 410 Mbps). Mide render, reproducción y scrub en cada escalón, y con las tres calidades. */
import http from 'http';
const PORT=process.argv[2]||9223;
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:PORT,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:600000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out={};
const DIR=String.raw`C:\Users\beltr\Desktop\Alma Digital Studio\Studio\Reel 360\Edit Reel 360\Neurocosm 360`;

/* importar los 9 clips (cada uno tarda: son ficheros de hasta 800 MB) */
out.importar=await ev(`(async function(){ const dir=${JSON.stringify(DIR)};
  const nombres=['Neuro1_7196.mp4','Neuro2_7196.mp4','Neuro3_7196.mp4','Neuro4_7196.mp4','Neuro5_7196.mp4','Neuro6_7196.mp4','Neuro7_7196.mp4','Neuro8_7196.mp4','Neuro9_7196.mp4'];
  const r=[]; const t0=performance.now();
  for(const n of nombres){ const ya=state.media.find(m=>m.name===n); if(ya){ r.push({n,ya:true}); continue; }
    const t1=performance.now(); const m=await addVideoFromPath(dir+'\\\\'+n,n);
    r.push({n, ok:!!m, ms:Math.round(performance.now()-t1), px:m?(m.w+'x'+m.h):null, dur:m?+m.dur.toFixed(1):null, fps:m?m.fps:null}); }
  return { msTotal:Math.round(performance.now()-t0), clips:r }; })()`);

/* apilar N capas simultáneas en el instante 5s y medir */
await ev(`window.__montar=async function(n){
  const seq=activeSeq(); state.clips=[];                                   // se parte de la sala vacía
  const vids=state.media.filter(m=>m.kind==='video'&&m.w>4000).slice(0,n); // sólo los 7196
  const lanesV=state.lanes.map((l,i)=>({l,i})).filter(x=>x.l.kind==='video');
  while(lanesV.length<n){ state.lanes.push({id:uid(),name:'V'+(state.lanes.length+1),tag:'V'+(state.lanes.length+1),kind:'video',surf:'wall'}); lanesV.push({l:state.lanes[state.lanes.length-1],i:state.lanes.length-1}); }
  vids.forEach((m,k)=>{ addClip(m, lanesV[k].i, 0); const c=state.clips[state.clips.length-1];
    if(c){ c.dur=Math.min(10,m.dur||10); c.props.opacity=(k===0?100:60); } });
  state.playhead=5;
  await Promise.all(collectDrawnVideoClips(state.clips,state.lanes,state.playhead,0,[]).map(({c,m,local})=>vinstSeek(c,m,local)));
  renderTimeline(); render();
  return { capas:vids.length, clips:state.clips.length }; };1`);

async function escalon(n){
  const montaje=await ev(`__montar(${n})`);
  await wait(2500);                                 // que los decodificadores lleguen al fotograma
  const r={montaje};
  r.render=await ev(`__mide(30)`);
  r.play=await ev(`__play(4)`);
  await wait(300);
  r.scrub=await ev(`(async function(){ const ts=[2,7,3,9,5,1,8]; const lat=[];
    for(const t of ts){ const t0=performance.now(); state.playhead=t;
      await Promise.all(collectDrawnVideoClips(state.clips,state.lanes,t,0,[]).map(({c,m,local})=>vinstSeek(c,m,local)));
      render(); gl.finish(); lat.push(performance.now()-t0); }
    const o=lat.slice().sort((a,b)=>a-b);
    return { saltos:lat.length, msMediana:+o[Math.floor(o.length/2)].toFixed(0), msPeor:+o[o.length-1].toFixed(0) }; })()`);
  r.vram=await ev(`__vram()`);
  r.errs=await ev(`window.__errs.length`);
  return r;
}
out.B1_unaCapa=await escalon(1);
out.B2_dosCapas=await escalon(2);
out.B3_tresCapas=await escalon(3);
out.B4_cuatroCapas=await escalon(4);

/* calidad de preview con la carga máxima */
out.C_calidad={};
for(const q of [1,0.5,0.25]){ await ev(`applyPreviewQuality(${q}); render();`); await wait(600);
  out.C_calidad['q'+q]={ ...(await ev(`__mide(30)`)), composite:await ev(`[compW,compH]`), vram:await ev(`__vram()`) }; }
await ev(`applyPreviewQuality(1); render();`);

out.errs=await ev(`window.__errs.slice(0,25)`);
console.log(JSON.stringify(out,null,1));
ws.close();
