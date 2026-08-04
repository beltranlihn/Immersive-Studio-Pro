import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
console.log(await ev(`(function(){
  document.querySelectorAll('#compOv').forEach(o=>o.remove());
  const n=state.media.find(x=>x.kind==='nest'&&x.comp);
  if(!n)return 'sin nido';
  openCompose(null,null,n,null,null);
  const ovs=document.querySelectorAll('#compOv').length;
  const c=document.querySelector('#cMedia');
  return { overlays:ovs, hayCesta:!!c, clase:c?c.className:'-', htmlLargo:c?c.innerHTML.length:0,
           html:c?c.innerHTML.slice(0,220):'-', compMediaIds:(n.comp.mediaIds||[]).length }; })()`));
console.log(await ev(`(function(){ const c=document.querySelector('#cMedia'); return c?[...c.querySelectorAll('.cbname')].map(e=>e.textContent):'no hay'; })()`));
ws.close();
