/* [R230c] Identidad de superficie de las pistas al duplicar y al crear sin preguntar. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await ev(`window.__errs=[];addEventListener('error',e=>__errs.push(String(e.message||e)));localStorage.removeItem('ispRoomVp');1`);
await ev(`(async()=>{try{await startDemoProject('room');}catch(e){window.__d=String(e);}})()`); await wait(2500);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){}
 document.querySelector('#viewModeSeg button[data-v="2d"]').click(); resize(); renderTimeline(); return 1;})()`); await wait(600);
const out={};
out.antes = await ev(`state.lanes.map(l=>({tag:l.tag,name:l.name,surf:l.surf||null}))`);

// duplicar una pista de PISO: la copia tiene que seguir siendo piso, con tag F y nombre = tag
out.dupPiso = await ev(`(function(){ const li=state.lanes.findIndex(l=>l.surf==='floor'); duplicateLane(li);
  const nl=state.lanes[li+1]; const c=state.clips.find(c=>c.lane===li+1);
  return {tag:nl.tag,name:nl.name,surf:nl.surf||null, clipCopiado:!!c,
    rectSuperficie:c?clipSurfRect(c):null, panel:c?(clipPanel(c)||{}).surf:null}; })()`);

// duplicar una pista de MURO
out.dupMuro = await ev(`(function(){ const li=state.lanes.findIndex(l=>l.surf==='wall'); duplicateLane(li);
  const nl=state.lanes[li+1]; return {tag:nl.tag,name:nl.name,surf:nl.surf||null}; })()`);

// ⌘T y la paleta: sin preguntar, la pista nueva cae en los MUROS (no suelta)
out.sinPreguntar = await ev(`(function(){ const n0=state.lanes.length; addLane('video');
  const nl=state.lanes[state.lanes.length-1]; return {tag:nl.tag,name:nl.name,surf:nl.surf||null,creadas:state.lanes.length-n0}; })()`);

// el audio y el 2D plano NO cambian de comportamiento
out.audio = await ev(`(function(){ addLane('audio'); const l=state.lanes.find(x=>x.kind==='audio'&&x.tag==='A2'); return l?{tag:l.tag,surf:l.surf||null}:null; })()`);
out.plano = await ev(`(async function(){ await newProject('flat',1920,1080,60,null,true); addLane('video');
  const nl=state.lanes[state.lanes.length-1]; const d=(function(){ const li=state.lanes.findIndex(l=>l.kind==='video'); duplicateLane(li); return state.lanes[li+1]; })();
  return {nueva:{tag:nl.tag,surf:nl.surf||null}, dup:{tag:d.tag,name:d.name,surf:d.surf||null}}; })()`);
out.errs = await ev(`window.__errs.slice(0,20)`);
console.log(JSON.stringify(out,null,1));
ws.close();
