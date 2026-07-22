// Open the room-setup dialog in the running dev app and screenshot it.
import http from 'http'; import fs from 'fs';
const port=9222;
function targets(){ return new Promise((res,rej)=>{ http.get({host:'127.0.0.1',port,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b));}catch(e){rej(e);}});}).on('error',rej); }); }
const list=await targets();
const page=list.find(t=>t.type==='page'&&t.webSocketDebuggerUrl);
if(!page){ console.error('no page target'); process.exit(1); }
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res,rej)=>{ ws.onopen=res; ws.onerror=()=>rej(new Error('ws fail')); });
let id=0; const pend=new Map();
ws.onmessage=ev=>{ const m=JSON.parse(ev.data); if(m.id&&pend.has(m.id)){ pend.get(m.id)(m); pend.delete(m.id); } };
const cmd=(method,params={})=>new Promise((res,rej)=>{ const i=++id; pend.set(i,m=>m.error?rej(new Error(JSON.stringify(m.error))):res(m.result)); ws.send(JSON.stringify({id:i,method,params})); });
async function evalExpr(expr){ const r=await cmd('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true}); if(r.exceptionDetails)throw new Error('page threw: '+(r.exceptionDetails.exception?.description||r.exceptionDetails.text)); return r.result.value; }
// close any existing overlay, open a fresh room dialog
await evalExpr(`(()=>{ document.querySelectorAll('.overlay').forEach(o=>o.remove()); roomSetupDialog(()=>{}); return 'opened'; })()`);
await new Promise(r=>setTimeout(r,600));
// hover the second wall row to test the active-highlight linkage
await evalExpr(`(()=>{ const r=document.querySelectorAll('#rsWalls .rs-wall')[1]; if(r)r.dispatchEvent(new PointerEvent('pointerenter',{bubbles:true})); return document.querySelectorAll('#rsWalls .rs-wall').length; })()`).then(n=>console.log('wall rows:',n));
await new Promise(r=>setTimeout(r,400));
const {data}=await cmd('Page.captureScreenshot',{format:'png'});
const out='C:/Users/beltr/AppData/Local/Temp/claude/C--Users-beltr-Desktop-Alma-Digital-Studio-Projects-Immersive-Studio-Pro/7d9f439c-5c4b-4ea0-8a7b-1a4141a04453/scratchpad/room-shot.png';
fs.writeFileSync(out,Buffer.from(data,'base64'));
console.log('saved',out);
ws.close();
