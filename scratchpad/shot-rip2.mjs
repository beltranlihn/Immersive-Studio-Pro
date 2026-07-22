// Verify the NEW render-in-place code paths (export flags + import + replace) with a minimal render.
import http from 'http';
const PDIR = 'C:\\Users\\beltr\\AppData\\Local\\Temp\\claude\\C--Users-beltr-Desktop-Alma-Digital-Studio-Projects-Immersive-Studio-Pro\\7d9f439c-5c4b-4ea0-8a7b-1a4141a04453\\scratchpad\\riptest2';
const list=await new Promise((res,rej)=>http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej));
const page=list.find(t=>t.type==='page'&&t.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=()=>rej(new Error('ws'));});
let id=0; const p=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=expr=>new Promise((res,rej)=>{const i=++id;p.set(i,m=>{if(m.error)return rej(new Error(JSON.stringify(m.error)));const r=m.result;if(r.exceptionDetails)return rej(new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text));res(r.result.value);});ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:true,returnByValue:true}}));});
const J = s => JSON.stringify(s); // correct JS-literal escaping for Windows paths
await ev('window.__alerts=[]; window.appAlert=function(m){ window.__alerts.push(String(m)); }; void 0;');

// Stage 1 — flat 640×360 project + saved path + image clip with an effect
const s1=await ev(`(async()=>{
  state.dirty=false; await newProject('flat',640,360,30);
  await DSP.ensureDir(${J(PDIR)}); currentPath=${J(PDIR)}+String.fromCharCode(92)+'proj.isp';
  const cv=document.createElement('canvas'); cv.width=256;cv.height=256; const g=cv.getContext('2d');
  g.fillStyle='#2f7d5b'; g.fillRect(0,0,256,256); g.fillStyle='#fff'; g.font='bold 60px sans-serif'; g.textAlign='center'; g.fillText('RIP',128,150);
  const blob=await new Promise(r=>cv.toBlob(r,'image/png')); const file=new File([blob],'riptest.png',{type:'image/png'});
  const before=state.media.length; addImage(file,null);
  for(let i=0;i<60 && state.media.length<=before;i++) await new Promise(r=>setTimeout(r,80));
  addClip(state.media[state.media.length-1],0,0); const clip=state.clips[state.clips.length-1]; clip.dur=0.5; clip.props.exposure=30; renderTimeline();
  window._ripClip=clip;
  return JSON.stringify({mediaKind:state.media[state.media.length-1].kind, nClips:state.clips.length, dur:clip.dur});
})()`);
console.log('stage1:',s1);

// Stage 2 — minimal isolated render via the export engine (flags: rangeT + isolateClips + outPath + silent)
const s2=await ev(`(async()=>{
  const c=window._ripClip; const bs=String.fromCharCode(92);
  const i=Math.max(currentPath.lastIndexOf(bs),currentPath.lastIndexOf('/')); const dir=currentPath.slice(0,i)+bs+'rendered clips'; await DSP.ensureDir(dir);
  const outPath=dir+bs+'diag.mp4'; window._ripOut=outPath;
  let thrown=null; const job={prog:()=>{},label:()=>{},done:()=>{}};
  try{ await runExport({codec:'h264',res:640,fps:30,bitrate:12e6,range:'clips',rangeT:[0,0.1],isolateClips:[c],outPath,silent:true,job}); }catch(e){ thrown=e.message; }
  let sz=-1; try{ const s=await DSP.stat(outPath); sz=s?s.size:'missing'; }catch(e){ sz='ERR'; }
  return JSON.stringify({thrown, sz, alerts:window.__alerts.slice(), nClipsAfter:state.clips.length});
})()`);
console.log('stage2 (render):',s2);

// Stage 3 — import the rendered file + run the replacement logic
const s3=await ev(`(async()=>{
  const st=await DSP.stat(window._ripOut); if(!st||!st.size) return 'no file to import';
  const nm=await addVideoFromPath(window._ripOut,'baked'); if(!nm) return 'import failed';
  const c=window._ripClip; pushUndo();
  const lane=c.lane,start=c.start,dur=c.dur; const nc=makeClip(nm,lane,start); nc.start=start; nc.dur=dur; nc.inP=0;
  if(!isFlat())nc.props.fulldome=true;
  const idx=state.clips.indexOf(c); if(idx>=0)state.clips.splice(idx,1);
  state.clips.push(nc); state.selId=nc.id; renderTimeline();
  const sel=state.clips.find(x=>x.id===state.selId); const m=sel&&mediaById(sel.mediaId);
  return JSON.stringify({selKind:m&&m.kind, selDur:sel&&sel.dur, selStart:sel&&sel.start, origGone:state.clips.indexOf(c)<0, nClips:state.clips.length, mediaKinds:state.media.map(x=>x.kind)});
})()`);
console.log('stage3 (replace):',s3);
ws.close();
