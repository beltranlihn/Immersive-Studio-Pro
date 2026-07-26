import { targets } from './cdp.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let idx=null; for(let i=0;i<150;i++){const l=await targets(9223).catch(()=>[]);idx=l.find(t=>t.type==='page'&&/index\.html/.test(t.url||'')&&t.webSocketDebuggerUrl);if(idx)break;await wait(200);}
if(!idx){console.log('sin exe');process.exit(1);}
const ws=new WebSocket(idx.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=()=>j(new Error('ws'))});
let _id=0; const send=(m,p)=>new Promise((res,rej)=>{const id=++_id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id!==id)return;ws.removeEventListener('message',h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)};ws.addEventListener('message',h);ws.send(JSON.stringify({id,method:m,params:p}))});
const evl=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)return{ROTO:JSON.stringify(r.exceptionDetails).slice(0,300)};return r.result.value};
console.log(JSON.stringify(await evl(`(()=>{
  const i=FSEQ.indexOf('vec2 uv=vec2');
  return { hayFSEQ:typeof FSEQ==='string', linea: i>=0? FSEQ.substr(i,60) : 'no encontrada',
    incluyeMas: FSEQ.includes('0.5 + lat'), incluyeMenos: FSEQ.includes('0.5 - lat'),
    esferaLinea:(()=>{const j=FSPH.indexOf('vec2 uv=vec2'); return j>=0?FSPH.substr(j,60):'no';})() };
})()`),null,2));
ws.close();
