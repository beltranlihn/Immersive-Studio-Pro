import http from 'http'; import fs from 'fs'; import os from 'os'; import path from 'path';
const port=9222;
// Path de capturas portable (Mac/Windows): $ISP_SHOTS o <tmp>/isp-r229/. Antes estaba fijo a una ruta de Windows.
const SHOTS=(process.env.ISP_SHOTS||path.join(os.tmpdir(),'isp-r229'))+path.sep;
function targets(){ return new Promise((res,rej)=>{ http.get({host:'127.0.0.1',port,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b));}catch(e){rej(e);}});}).on('error',rej); }); }
try{ fs.mkdirSync(SHOTS,{recursive:true}); }catch(_){}
const list=await targets();
const page=list.find(t=>t.type==='page'&&t.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res,rej)=>{ ws.onopen=res; ws.onerror=()=>rej(new Error('ws fail')); });
let id=0; const pend=new Map();
ws.onmessage=ev=>{ const m=JSON.parse(ev.data); if(m.id&&pend.has(m.id)){ pend.get(m.id)(m); pend.delete(m.id); } };
const cmd=(method,params={})=>new Promise((res,rej)=>{ const i=++id; pend.set(i,m=>m.error?rej(new Error(JSON.stringify(m.error))):res(m.result)); ws.send(JSON.stringify({id:i,method,params})); });
const ev=async(expr)=>{ const r=await cmd('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true,timeout:60000}); if(r.exceptionDetails)throw new Error('threw: '+(r.exceptionDetails.exception?.description||r.exceptionDetails.text)); return r.result.value; };
const shot=async(name)=>{ const {data}=await cmd('Page.captureScreenshot',{format:'png'}); fs.writeFileSync(SHOTS+name,Buffer.from(data,'base64')); return SHOTS+name; };
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await ev(`(function(){ window.__errs=[]; window.addEventListener('error',e=>window.__errs.push(String(e.message||e))); window.addEventListener('unhandledrejection',e=>window.__errs.push('rej: '+String((e.reason&&e.reason.message)||e.reason))); const ce=console.error; console.error=function(){ try{window.__errs.push('con: '+[...arguments].map(String).join(' '));}catch(_){} return ce.apply(console,arguments); }; return 'hooked'; })()`);

// Build the 360 room demo
await ev(`(async()=>{ try{ await startDemoProject('room'); }catch(e){ window.__demoErr=String(e&&e.message||e); } })()`);
await wait(1800);
// dismiss the tour overlay so it doesn't cover the screenshot
await ev(`(function(){ try{ if(typeof _tourStop==='function')_tourStop(); const o=document.getElementById('tourOv'); if(o)o.remove(); }catch(e){} return 1; })()`);
await ev(`(function(){ state.playhead=Math.min(6, (typeof duration==='function'?duration():8)/2); render(); renderTimeline(); return 1; })()`);
await wait(500);

const info=await ev(`(function(){
  const lanes=state.lanes.map((l,i)=>({i,name:l.name,tag:l.tag,kind:l.kind,surf:l.surf||null}));
  const as=activeSeq(), room=as&&as.room;
  // surface rects for a wall clip and a floor clip
  const clips=state.clips.map(c=>({id:c.id,lane:c.lane,surf:(state.lanes[c.lane]||{}).surf||null,media:(mediaById(c.mediaId)||{}).kind, x:c.props&&c.props.x, y:c.props&&c.props.y}));
  return {demoErr:window.__demoErr||null, errs:window.__errs.slice(0,20), seqMode:state.seqMode, w:as&&as.w, h:as&&as.h, stripH:room&&room.stripH, floor:!!(room&&room.floor), fx:(room&&room.walls||[]).map(w=>({role:w.role,x0:w.x0,x1:w.x1})), lanes, clips};
})()`);
console.log(JSON.stringify(info,null,1));
await shot('room-2d.png');
// switch to 3D to confirm 3D still renders
await ev(`(function(){ const b=document.querySelector('#viewModeSeg button[data-v=\\'3d\\']'); if(b)b.click(); return 1; })()`);
await wait(700); await shot('room-3d.png');
const errs2=await ev(`window.__errs.slice(0,20)`);
console.log('ERRS_AFTER_3D',JSON.stringify(errs2));
ws.close();
console.log('SHOTS',SHOTS);
