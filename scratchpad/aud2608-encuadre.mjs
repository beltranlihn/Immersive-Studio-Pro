/* [AUDIT 2026-08] Encuadre por secuencia (R239): ida y vuelta padre⇄nido sobre el .exe. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out={};
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e))); return 1; })()`);
await ev(`state.dirty=false;1`);
await ev(`(async()=>{try{await startDemoProject('flat');}catch(e){window.__d=String(e);}})()`); await wait(2500);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){}return 1;})()`); await wait(400);

out.paso1=await ev(`(function(){ // en el padre: alejar el zoom para que haya ancho, y desplazar la vista
  state.tl.pxPerSec=200; renderTimeline();
  const sc=document.querySelector('#tlscroll'); state.tl._scrollTarget=5000; renderTimeline(); sc.scrollLeft=5000; state.tl._scrollTarget=0;
  const nest=state.media.find(m=>m.kind==='nest'&&m.id!==state.activeSeqId);
  return { padre:state.activeSeqId, nestId:nest?nest.id:null, scrollPadre:sc.scrollLeft }; })()`);

out.paso2=await ev(`(function(){ const nest=state.media.find(m=>m.kind==='nest'&&m.id!==state.activeSeqId);
  openSeq(nest.id); const sc=document.querySelector('#tlscroll');
  return { activa:state.activeSeqId===nest.id, scrollAlEntrar:sc.scrollLeft }; })()`);

out.paso3=await ev(`(function(){ // dentro del nido: desplazar a 1234 px y volver al padre
  const sc=document.querySelector('#tlscroll'); state.tl._scrollTarget=1234; renderTimeline(); sc.scrollLeft=1234; state.tl._scrollTarget=0;
  const padre=state.openSeqs[0]; switchSeq(padre);
  return { scrollAlVolverAlPadre:sc.scrollLeft }; })()`);

out.paso4=await ev(`(function(){ // re-entrar al nido: debe volver a 1234
  const nest=state.media.find(m=>m.kind==='nest'&&m.id!==state.activeSeqId);
  switchSeq(nest.id); const sc=document.querySelector('#tlscroll');
  const r={ scrollAlReentrar:sc.scrollLeft };
  switchSeq(state.openSeqs[0]); state.dirty=false; return r; })()`);

out.errs=await ev(`window.__errs.slice(0,10)`);
console.log(JSON.stringify(out,null,1));
ws.close();
