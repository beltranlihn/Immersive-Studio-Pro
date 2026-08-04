/* [R241] Regenera los proxies que la prueba dejó a 30 fps (se crearon cuando `detectFps` aún fallaba).
   Un proxy a media tasa es PEOR que no tenerlo: al montar enseña la mitad de los fotogramas. */
import http from 'http';
const PORT=process.argv[2]||9224;
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:PORT,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:1500000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const r=await ev(`(async function(){
  const vids=state.media.filter(m=>m.kind==='video'&&m.w>4000);
  const antes=vids.map(v=>({n:v.name,fps:v.fps,proxy:!!v.proxyReady}));
  for(const v of vids){ v.proxyReady=false; v.proxyPct=0; v._pxGen=true; v._proxyForce=true; enqProxy(v); }
  const t0=performance.now(), lim=t0+20*60*1000;
  while(performance.now()<lim){ await new Promise(r=>setTimeout(r,4000));
    if(vids.every(v=>v.proxyReady||v.missing))break; }
  return { msTotal:Math.round(performance.now()-t0), antes,
    despues:vids.map(v=>({n:v.name,fps:v.fps,proxy:!!v.proxyReady,pct:v.proxyPct})) }; })()`);
console.log(JSON.stringify(r,null,1));
ws.close();
