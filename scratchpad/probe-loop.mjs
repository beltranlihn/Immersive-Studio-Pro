import { targets } from './cdp.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let idx=null; for(let i=0;i<120;i++){const l=await targets(9222).catch(()=>[]);idx=l.find(t=>t.type==='page'&&/index\.html/.test(t.url||'')&&t.webSocketDebuggerUrl);if(idx)break;await wait(150);}
const ws=new WebSocket(idx.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=()=>j(new Error('ws'))});
let _id=0; const send=(m,p)=>new Promise((res,rej)=>{const id=++_id;const h=ev=>{const x=JSON.parse(ev.data);if(x.id!==id)return;ws.removeEventListener('message',h);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result)};ws.addEventListener('message',h);ws.send(JSON.stringify({id,method:m,params:p}))});
const evl=async e=>{const r=await send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails).slice(0,300));return r.result.value};
await send('Emulation.setDeviceMetricsOverride',{width:1600,height:900,deviceScaleFactor:1,mobile:false,screenWidth:1600,screenHeight:900});
await send('Page.reload',{ignoreCache:true}); await wait(2000);
for(let i=0;i<60;i++){try{if(await evl('typeof state!=="undefined"&&!!document.getElementById("tracks")'))break}catch(e){}await wait(400)}
await evl(`(()=>{try{localStorage.setItem('dspOnboardV1','1')}catch(e){}document.querySelectorAll('.overlay,#tourOv,#landingOv').forEach(o=>o.remove());document.body.classList.remove('preboot');try{resize()}catch(e){}return 1})()`);
await evl(`(async()=>{state.dirty=false;await buildDemoProject();return 1})()`); await wait(700);

// A · bucle DIRECTO: la secuencia activa dentro de sí misma
console.log('bucle directo  ', JSON.stringify(await evl(`(()=>{ const li=state.lanes.map((l,i)=>i).find(i=>state.lanes[i].kind!=='audio');
  const n0=state.clips.length; addClip(mediaById(state.activeSeqId), li, 0);
  return {clipsAntes:n0, clipsDespues:state.clips.length, rechazado:state.clips.length===n0}; })()`)));

// B · bucle INDIRECTO: A contiene B; meter A dentro de B
console.log('bucle indirecto', JSON.stringify(await evl(`(()=>{
  state.selIds=state.clips.slice(0,2).map(c=>c.id); state.selId=state.selIds[0]; nestSelection();  // crea B dentro de A(activa)
  const B=state.media.filter(m=>isSeqMedia(m)).slice(-1)[0]; const A=state.activeSeqId;
  switchSeq(B.id);                                  // ahora la activa es B
  const li=state.lanes.map((l,i)=>i).find(i=>state.lanes[i].kind!=='audio');
  const n0=state.clips.length; addClip(mediaById(A), li, 0);   // meter A dentro de B → bucle
  const r={activa:state.activeSeqId===B.id, clipsAntes:n0, clipsDespues:state.clips.length, rechazado:state.clips.length===n0};
  switchSeq(A); return r; })()`)));

// C · el huérfano: quién es
console.log('\nhuérfano       ', JSON.stringify(await evl(`(async()=>{
  const c=state.clips[0]; state.selIds=[c.id]; state.selId=c.id; for(let i=0;i<6;i++){copyClip();pasteClip();}
  makeAdjustClip();
  const j=JSON.stringify(serProject()); loadProject(JSON.parse(j)); await new Promise(r=>setTimeout(r,400));
  const h=state.clips.filter(x=>!x.adjust&&!mediaById(x.mediaId));
  return {clips:state.clips.length, medios:state.media.length, huerfanos:h.length,
    quienes:h.slice(0,4).map(x=>({nombre:x.name, mediaId:x.mediaId, eraSeq:!!(x.mediaId&&String(x.mediaId).length)})),
    idsDeMedios:state.media.map(m=>m.id)}; })()`)));
ws.close();
