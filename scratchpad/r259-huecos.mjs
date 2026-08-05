/* [R259b] Los dos caminos que toque en R259 y NO habia probado:
     A. PREVISUALIZACION / reproduccion — `step()` corre igual ahi (con anillo grande, ex=false).
     B. Export a VIDEO de verdad (H.264 mp4), no secuencia PNG.
   Sobre el proyecto real y su nido de 9 capas. Aborta si algo no cuadra. */
import http from 'http'; import fs from 'fs'; import path from 'path';
const ISP='C:/Users/beltr/Desktop/Alma Digital Studio/Projects/Immersive Studio Pro/scratchpad/aud8b-rito-copia.isp';
const morir=(m)=>{ console.log('\n*** ABORTADO: '+m); process.exit(1); };
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url)); if(!pg)morir('sin ventana');
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:900000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

await ev(`(async function(){ state.dirty=false; await openProjectPath(${JSON.stringify(ISP)},true); return 1; })()`);
await wait(8000);
const pr=await ev(`(function(){ return { medios:state.media.length,
  nido:(state.media.filter(m=>m.kind==='nest'&&(m.nestClips||[]).filter(c=>c.loop).length>0)
        .sort((a,b)=>(b.nestClips||[]).filter(c=>c.loop).length-(a.nestClips||[]).filter(c=>c.loop).length)[0]||{}).id }; })()`);
if(pr.medios<5) morir('el proyecto no cargo');
await ev(`(async function(){ openSeq(${JSON.stringify(pr.nido)}); await new Promise(r=>setTimeout(r,1500)); return 1; })()`);
const seq=await ev(`(function(){ return { n:(activeSeq()||{}).name, clips:state.clips.length, bucles:state.clips.filter(c=>c.loop).length }; })()`);
if(seq.clips===0) morir('secuencia vacia');
console.log('secuencia "'+seq.n+'": '+seq.clips+' clips, '+seq.bucles+' en bucle');
await ev(`(function(){ try{localStorage.removeItem('__ctx');}catch(e){} glc.addEventListener('webglcontextlost',()=>{try{localStorage.setItem('__ctx','perdido');}catch(e){}}); return 1; })()`);

/* ---- A. reproduccion en vivo, CRUZANDO la vuelta del bucle ---------------------------------- */
const vuelta=await ev(`(function(){ const c=state.clips.filter(x=>x.loop&&x.loopLen>0)
  .sort((a,b)=>(a.start+a.loopLen/(a.speed||1))-(b.start+b.loopLen/(b.speed||1)))[0];
  return +(c.start+c.loopLen/(c.speed||1)).toFixed(3); })()`);
console.log('\nA · reproduccion en vivo 6 s, arrancando 2 s antes de la vuelta ('+vuelta+'s)');
await ev(`(function(){ state.playhead=Math.max(0,${vuelta}-2); render(); play(); return 1; })()`);
await wait(6500);
const rep=await ev(`(function(){ const r={ cabezal:+state.playhead.toFixed(2), reproduciendo:state.playing,
  rendidos:state.media.filter(m=>m._cdFail).map(m=>m.name), ctx:localStorage.getItem('__ctx')||'ok' }; pause(); return r; })()`);
console.log('   cabezal en '+rep.cabezal+'s (arranco en '+(vuelta-2).toFixed(2)+') · contexto: '+rep.ctx
  +' · se rindieron: '+(rep.rendidos.length?rep.rendidos.join(', '):'ninguno'));
if(rep.ctx!=='ok') morir('se perdio el contexto grafico REPRODUCIENDO');
if(rep.cabezal < vuelta) morir('el cabezal no llego a cruzar la vuelta: la reproduccion se atasco');

/* ---- B. export a VIDEO real (H.264), no PNG ------------------------------------------------- */
const OUT=path.join(process.cwd(),'scratchpad','r259-video.mp4');
try{ fs.rmSync(OUT,{force:true}); }catch(e){}
console.log('\nB · export a H.264 (1 s del mismo tramo)');
const t0=Date.now();
const vid=await ev(`(async function(){ const ui=ripProgress('R259b','video',1);
  try{ await runExport({codec:'h264', res:512, fps:30, bitrate:12, range:'clips',
        rangeT:[${Math.max(0,vuelta-0.5)}, ${vuelta+0.5}], outW:512, outH:512,
        outPath:${JSON.stringify(OUT)}, silent:true, noAudio:true, job:ui.job}); }
  finally{ ui.close(); }
  return { rendidos:state.media.filter(m=>m._cdFail).map(m=>m.name), ctx:localStorage.getItem('__ctx')||'ok' }; })()`);
const ms=Date.now()-t0;
const hay=fs.existsSync(OUT)?fs.statSync(OUT).size:0;
console.log('   '+(hay?(Math.round(hay/1024)+' KB'):'*** NO SE ESCRIBIO EL ARCHIVO ***')+' en '+(ms/1000).toFixed(1)+' s'
  +' · contexto: '+vid.ctx+' · se rindieron: '+(vid.rendidos.length?vid.rendidos.join(', '):'ninguno'));
if(vid.ctx!=='ok') morir('se perdio el contexto grafico EXPORTANDO a video');
if(hay<5000) morir('el mp4 no se escribio o esta vacio');
console.log('\nlos dos huecos, cerrados.');
ws.close();
