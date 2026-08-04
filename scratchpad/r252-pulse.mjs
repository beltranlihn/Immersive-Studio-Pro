import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:30000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
/* la expresion EXACTA que tenia addAnimPreset antes de R252, evaluada sobre las tablas actuales */
console.log(await ev(`(function(){
  const viejo=ANIM_PRESETS.concat(ANIM_PRESETS_FLAT).find(x=>x.key==='pulse');
  const nuevo=curAnimPresets().find(x=>x.key==='pulse');
  const chipQueSeVe=curAnimPresets().find(x=>x.key==='pulse');
  return { secuencia:(isFlat()?'plana':'domo'),
           loQueBuscabaAntes:viejo.param, loQueDiceElChip:chipQueSeVe?chipQueSeVe.param:'-',
           loQueBuscaAhora:nuevo?nuevo.param:'-',
           coincidian:viejo.param===(chipQueSeVe?chipQueSeVe.param:null) }; })()`));
ws.close();
