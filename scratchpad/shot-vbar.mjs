import { targets } from './cdp.mjs';
import fs from 'fs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let idx=null; for(let i=0;i<150;i++){const l=await targets(9222).catch(()=>[]);idx=l.find(t=>t.type==='page'&&/index\.html/.test(t.url||'')&&t.webSocketDebuggerUrl);if(idx)break;await wait(200);}
const ws=new WebSocket(idx.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=()=>j(new Error('ws'))});
let _id=0; const send=(m,p)=>new Promise((res,rej)=>{const id=++_id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id!==id)return;ws.removeEventListener('message',h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)};ws.addEventListener('message',h);ws.send(JSON.stringify({id,method:m,params:p}))});
const evl=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)return{ROTO:1};return r.result.value};
const r=await evl(`(()=>{const p=document.querySelector('.timeline').getBoundingClientRect();return {x:Math.round(p.right)-150,y:Math.round(p.top),w:150,h:Math.round(p.height)};})()`);
const s=await send('Page.captureScreenshot',{format:'png',clip:{x:r.x,y:r.y,width:r.w,height:r.h,scale:2}});
fs.writeFileSync('scratchpad/shots/18-barra-vertical.png', Buffer.from(s.data,'base64'));
console.log('guardada');
ws.close();
