import { targets } from './cdp.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let idx=null; for(let i=0;i<120;i++){const l=await targets(9222).catch(()=>[]);idx=l.find(t=>t.type==='page'&&/index\.html/.test(t.url||'')&&t.webSocketDebuggerUrl);if(idx)break;await wait(200);}
const ws=new WebSocket(idx.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=()=>j(new Error('ws'))});
let _id=0; const send=(m,p)=>new Promise((res,rej)=>{const id=++_id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id!==id)return;ws.removeEventListener('message',h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)};ws.addEventListener('message',h);ws.send(JSON.stringify({id,method:m,params:p}))});
const evl=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)return{ROTO:1};return r.result.value};
console.log(JSON.stringify(await evl(`(()=>({
  capas:[...document.querySelectorAll('.overlay')].map(o=>({id:o.id||'(sin id)', texto:(o.textContent||'').replace(/\s+/g,' ').trim().slice(0,90)})),
  botones:[...document.querySelectorAll('.overlay button')].map(b=>b.id||b.textContent.trim().slice(0,20))
}))()`),null,2));
ws.close();
