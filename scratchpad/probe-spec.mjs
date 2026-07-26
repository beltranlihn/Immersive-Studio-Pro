import { targets } from './cdp.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let idx=null; for(let i=0;i<150;i++){const l=await targets(9222).catch(()=>[]);idx=l.find(t=>t.type==='page'&&/index\.html/.test(t.url||'')&&t.webSocketDebuggerUrl);if(idx)break;await wait(200);}
const ws=new WebSocket(idx.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=()=>j(new Error('ws'))});
let _id=0; const send=(m,p)=>new Promise((res,rej)=>{const id=++_id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id!==id)return;ws.removeEventListener('message',h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)};ws.addEventListener('message',h);ws.send(JSON.stringify({id,method:m,params:p}))});
const evl=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)return{ROTO:JSON.stringify(r.exceptionDetails).slice(0,400)};return r.result.value};
console.log('espectro ', JSON.stringify(await evl(`(async()=>{
  const m=state.media.find(x=>x.name==='Umbral.wav'); if(!m) return {sinMedio:true};
  if(typeof armMediaSpectrum!=='function') return {sinFuncion:true};
  armMediaSpectrum(m, m.buffer);
  for(let i=0;i<250;i++){ if(m.spec) break; await new Promise(r=>setTimeout(r,150)); }
  if(!m.spec) return {noCalculo:true, ocupado:!!m._specBusy};
  const sp=m.spec;
  const col=sp.data?sp.data:sp;
  return { columnas:sp.cols||sp.n||(col&&col.length)||'?', binsPorColumna:sp.bins||'?',
    claves:Object.keys(sp).slice(0,8), hz:sp.sr||sp.rate||'?' }; })()`),null,2));
// y que el medidor de 32 bandas se alimente de verdad
console.log('medidor  ', JSON.stringify(await evl(`(()=>{
  const c=state.clips.find(x=>{const m=mediaById(x.mediaId);return m&&m.kind==='audio';});
  if(c){ state.selIds=[c.id]; state.selId=c.id; }
  try{ arRecompute&&arRecompute(); }catch(e){}
  const col=(typeof specColAt==='function')?specColAt(1.5):'sin specColAt';
  return { specColAt: col? (col.length?('array de '+col.length):typeof col) : 'devuelve null (cae a las 4 bandas)' }; })()`)));
ws.close();
