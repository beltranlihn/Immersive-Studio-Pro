import { targets } from './cdp.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let idx=null; for(let i=0;i<150;i++){const l=await targets(9222).catch(()=>[]);idx=l.find(t=>t.type==='page'&&/index\.html/.test(t.url||'')&&t.webSocketDebuggerUrl);if(idx)break;await wait(200);}
const ws=new WebSocket(idx.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=()=>j(new Error('ws'))});
let _id=0; const send=(m,p)=>new Promise((res,rej)=>{const id=++_id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id!==id)return;ws.removeEventListener('message',h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)};ws.addEventListener('message',h);ws.send(JSON.stringify({id,method:m,params:p}))});
const evl=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)return{ROTO:JSON.stringify(r.exceptionDetails).slice(0,300)};return r.result.value};
console.log(JSON.stringify(await evl(`(()=>{
  const el=document.getElementById('statSel');
  const antes=el?el.textContent.trim():'sin #statSel';
  try{ updStatus(); }catch(e){}
  return { clipsReales:state.clips.length, mediosReales:state.media.length,
    barraAntes:antes, barraDespues:el?el.textContent.trim():'sin #statSel',
    seArreglaSolo:(el&&el.textContent.trim()!==antes) };
})()`),null,2));
ws.close();
