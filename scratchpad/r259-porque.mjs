/* [R259] ¿Por que se recargo la pagina durante la exportacion? El manejador de `webglcontextlost` recarga a
   proposito tras 1,8 s y ANTES autoguarda en localStorage['domeProPro'] — asi que ese rastro lo delata. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):res(r.result.result.value));
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
console.log(JSON.stringify(await ev(`(function(){
  const auto=localStorage.getItem('domeProPro');
  let autoInfo='no hay';
  if(auto){ try{ const o=JSON.parse(auto); autoInfo=(o.media?o.media.length:0)+' medios, '+(o.clips?o.clips.length:0)+' clips'; }catch(e){ autoInfo='ilegible'; } }
  return { edadPaginaSeg: Math.round(performance.now()/1000),
           autoguardadoDeEmergencia: autoInfo,
           contextoPerdido: (typeof glLost!=='undefined')?glLost:'?',
           medios: state.media.length, clips: state.clips.length,
           secuencia: (state.media.find(m=>m.id===state.activeSeqId)||{}).name || '(ninguna)' }; })()`),null,1));
ws.close();
