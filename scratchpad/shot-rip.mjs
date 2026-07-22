// Verify render-in-place end to end: flat project + image clip → renderInPlace → file written + clip replaced.
import http from 'http';
const list=await new Promise((res,rej)=>http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej));
const page=list.find(t=>t.type==='page'&&t.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=()=>rej(new Error('ws'));});
let id=0; const p=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=expr=>new Promise((res,rej)=>{const i=++id;p.set(i,m=>{if(m.error)return rej(new Error(JSON.stringify(m.error)));const r=m.result;if(r.exceptionDetails)return rej(new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text));res(r.result.value);});ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:expr,awaitPromise:true,returnByValue:true}}));});
const PDIR='C:\\\\Users\\\\beltr\\\\AppData\\\\Local\\\\Temp\\\\claude\\\\C--Users-beltr-Desktop-Alma-Digital-Studio-Projects-Immersive-Studio-Pro\\\\7d9f439c-5c4b-4ea0-8a7b-1a4141a04453\\\\scratchpad\\\\riptest';

// Stage 1 — flat project + saved path + image media + short clip
const s1=await ev(`(async()=>{
  state.dirty=false; await newProject('flat',1280,720,30);
  await DSP.ensureDir('${PDIR}'); currentPath='${PDIR}\\\\proj.isp';
  const cv=document.createElement('canvas'); cv.width=512;cv.height=512; const g=cv.getContext('2d');
  g.fillStyle='#2f7d5b'; g.fillRect(0,0,512,512); g.fillStyle='#fff'; g.font='bold 90px sans-serif'; g.textAlign='center'; g.fillText('RIP',256,290);
  const blob=await new Promise(r=>cv.toBlob(r,'image/png')); const file=new File([blob],'riptest.png',{type:'image/png'});
  const before=state.media.length; addImage(file,null);
  for(let i=0;i<60 && state.media.length<=before;i++) await new Promise(r=>setTimeout(r,100));
  const im=state.media[state.media.length-1];
  addClip(im,0,0); const clip=state.clips[state.clips.length-1]; clip.dur=0.5; clip.props.exposure=25; renderTimeline();
  window._ripClip=clip;
  return JSON.stringify({mediaKind:im&&im.kind, dur:clip.dur, path:currentPath, nClips:state.clips.length});
})()`);
console.log('stage1:',s1);

// Stage 2 — fire renderInPlace (don't await), then confirm the dialog
await ev(`window._ripPromise=renderInPlace(window._ripClip); void 0;`);
await new Promise(r=>setTimeout(r,700));
const dlg=await ev(`(()=>{ const b=document.querySelector('#ripGo'); if(b){ b.click(); return 'confirmed'; } return 'no-dialog'; })()`);
console.log('stage2:',dlg);

// Stage 3 — poll for completion
let done=null;
for(let i=0;i<90;i++){ await new Promise(r=>setTimeout(r,1000));
  const st=await ev(`(()=>{ const c=state.clips.find(x=>x.id===state.selId); const m=c&&mediaById(c.mediaId); return JSON.stringify({sel:state.selId, kind:m&&m.kind, path:(m&&m.path)||null, fulldome:!!(c&&c.props&&c.props.fulldome), nClips:state.clips.length}); })()`);
  const o=JSON.parse(st);
  if(o.kind==='video' && o.path && /rendered clips/i.test(o.path)){ done=o; break; }
  if(i%5===0)console.log('  poll',i,st);
}
console.log('stage3 done:',JSON.stringify(done));

// Stage 4 — list the rendered clips folder
const files=await ev(`(async()=>{ try{ const f=await DSP.listDir('${PDIR}\\\\rendered clips'); return JSON.stringify(f.map(x=>({n:x.name,sz:x.size}))); }catch(e){ return 'ERR '+e.message; } })()`);
console.log('rendered clips dir:',files);
// also nest still in media? (not applicable here, image) + original clip gone
const finalState=await ev(`JSON.stringify({nClips:state.clips.length, mediaCount:state.media.length, mediaKinds:state.media.map(m=>m.kind)})`);
console.log('final:',finalState);
ws.close();
