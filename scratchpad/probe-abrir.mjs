import { targets } from './cdp.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let idx=null; for(let i=0;i<120;i++){const l=await targets(9222).catch(()=>[]);idx=l.find(t=>t.type==='page'&&/index\.html/.test(t.url||'')&&t.webSocketDebuggerUrl);if(idx)break;await wait(200);}
if(!idx){console.log('sin editor');process.exit(1);}
const ws=new WebSocket(idx.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=()=>j(new Error('ws'))});
let _id=0; const send=(m,p)=>new Promise((res,rej)=>{const id=++_id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id!==id)return;ws.removeEventListener('message',h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)};ws.addEventListener('message',h);ws.send(JSON.stringify({id,method:m,params:p}))});
const evl=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)return{ROTO:JSON.stringify(r.exceptionDetails).slice(0,250)};return r.result.value};
console.log(JSON.stringify(await evl(`({
  rutaActual: (typeof currentPath!=='undefined')?currentPath:'sin currentPath',
  medios: state.media.length, tipos: state.media.map(m=>m.kind).join(','),
  clipsTop: state.clips.length,
  seqActiva: state.activeSeqId, abiertas:(state.openSeqs||[]).length,
  clipsEnNests: state.media.filter(m=>m.kind==='nest').reduce((s,m)=>s+((m.nestClips||[]).length),0),
  landing: !!document.getElementById('landingOv'),
  preboot: document.body.classList.contains('preboot'),
  esperando:(typeof _bootEsperandoProyecto!=='undefined')?_bootEsperandoProyecto:null,
  revelado:(typeof _bootRevelado!=='undefined')?_bootRevelado:null,
  pct:(typeof _bootPct!=='undefined')?_bootPct:null
})`),null,2));
ws.close();
