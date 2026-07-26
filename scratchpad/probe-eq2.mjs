import { targets } from './cdp.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let idx=null; for(let i=0;i<150;i++){const l=await targets(9222).catch(()=>[]);idx=l.find(t=>t.type==='page'&&/index\.html/.test(t.url||'')&&t.webSocketDebuggerUrl);if(idx)break;await wait(200);}
const ws=new WebSocket(idx.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=()=>j(new Error('ws'))});
let _id=0; const send=(m,p)=>new Promise((res,rej)=>{const id=++_id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id!==id)return;ws.removeEventListener('message',h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)};ws.addEventListener('message',h);ws.send(JSON.stringify({id,method:m,params:p}))});
const evl=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)return{ROTO:JSON.stringify(r.exceptionDetails).slice(0,500)};return r.result.value};
console.log(JSON.stringify(await evl(`(()=>{
  const cv=document.getElementById('arMeter'); if(!cv)return {sinLienzo:true};
  const info={ pestana:state.inspTab, clientW:cv.clientWidth, clientH:cv.clientHeight,
    display:getComputedStyle(cv).display, visible:cv.getBoundingClientRect().width>0,
    playhead:state.playhead, specEnEsePunto:(()=>{const c=specColAt(state.playhead);return c?c.length:'null';})() };
  let err=null; try{ arDrawMeter(); }catch(e){ err=String(e&&e.message); }
  info.errorAlDibujar=err;
  const x=cv.getContext('2d'); const d=x.getImageData(0,0,cv.width,cv.height).data;
  let alfa=0,color=0; for(let i=0;i<d.length;i+=4){ if(d[i+3]>0)alfa++; if(d[i]+d[i+1]+d[i+2]>12)color++; }
  info.pixelesConAlfa=alfa; info.pixelesConColor=color; info.totalPixeles=d.length/4;
  return info; })()`),null,2));
ws.close();
