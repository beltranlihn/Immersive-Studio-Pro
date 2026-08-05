/* [R277] Ejemplo con varias secuencias abiertas: la tira al principio y desplazada, para que se vea que se
   corta y que las demas estan ahi detras. */
import http from 'http'; import fs from 'fs';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`);
await wait(1600);
await ev(`(function(){
  const base=state.media.find(isSeqMedia);
  ['Intro','Rito - secuencia de apertura completa','Domo A','Escena 4 - alternativa','Creditos','Test 2']
    .forEach(nb=>{ const m=JSON.parse(JSON.stringify(base)); m.id=uid(); m.name=nb; state.media.push(m); state.openSeqs.push(m.id); });
  renderSeqBar(); renderMedia(); return 1; })()`);
await wait(600);
const g=await ev(`(function(){ const b=document.querySelector('#seqTabs').getBoundingClientRect();
  const tr=document.querySelector('.transport')||document.querySelector('#seqTabs').parentElement;
  const t2=tr.getBoundingClientRect();
  return {x:Math.round(t2.left),y:Math.round(t2.top),w:Math.round(t2.width),h:Math.round(t2.height),bx:Math.round(b.left)}; })()`);
const tira=async(nombre,scroll)=>{ await ev(`document.querySelector('#seqTabs').scrollLeft=${scroll}`); await wait(250);
  const s=await cmd('Page.captureScreenshot',{format:'png',clip:{x:g.x,y:Math.max(0,g.y-4),width:Math.min(g.w,760),height:g.h+8,scale:3}});
  fs.writeFileSync('scratchpad/'+nombre, Buffer.from(s.data,'base64')); console.log('captura: '+nombre); };
await tira('r277-ej-inicio.png',0);
await tira('r277-ej-desplazada.png',9999);
ws.close();
