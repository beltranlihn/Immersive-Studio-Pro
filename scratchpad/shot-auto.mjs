import { targets } from './cdp.mjs';
import fs from 'fs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let idx=null; for(let i=0;i<150;i++){const l=await targets(9222).catch(()=>[]);idx=l.find(t=>t.type==='page'&&/index\.html/.test(t.url||'')&&t.webSocketDebuggerUrl);if(idx)break;await wait(200);}
const ws=new WebSocket(idx.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=()=>j(new Error('ws'))});
let _id=0; const send=(m,p)=>new Promise((res,rej)=>{const id=++_id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id!==id)return;ws.removeEventListener('message',h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)};ws.addEventListener('message',h);ws.send(JSON.stringify({id,method:m,params:p}))});
const evl=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)return{ROTO:1};return r.result.value};
const r=await evl(`(()=>{ const cd=[...document.querySelectorAll('.clip')].find(x=>x.querySelector('canvas'));
  if(!cd)return null; const b=cd.getBoundingClientRect();
  return {x:Math.round(b.x)-4,y:Math.round(b.y)-4,w:Math.round(b.width)+8,h:Math.round(b.height)+8}; })()`);
if(!r){ console.log('sin clip con curva'); process.exit(1); }
const s=await send('Page.captureScreenshot',{format:'png',clip:{x:r.x,y:r.y,width:r.w,height:r.h,scale:3}});
fs.writeFileSync('scratchpad/shots/17-auto-sin-0-100.png', Buffer.from(s.data,'base64'));
console.log('guardada');
ws.close();
