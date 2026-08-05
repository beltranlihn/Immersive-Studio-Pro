import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):res(r.result.result.value));
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
console.log(JSON.stringify(await ev(`(function(){ const A=activeSeq();
  return { secuencia:A&&A.name, clips:state.clips.length, bucles:state.clips.filter(c=>c.loop).length,
    rendidos:state.media.filter(m=>m._cdFail).map(m=>m.name),
    faltan:state.media.filter(m=>m.missing).map(m=>m.name),
    exportando:exporting, calidad:_exportQuality }; })()`),null,1));
ws.close();
