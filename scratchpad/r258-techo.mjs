/* [R258] El TECHO del render-ahead: cuanto del coste de un re-scrub es composite (lo unico que el cache evita)
   y cuanto es decodificar (lo que no evita). Se mide por separado sobre el mismo montaje. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.text)):res(r.result.result.value)));
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true,timeout:900000}}));});
const r=await ev(`(async function(){ const ts=[3,3.5,4,4.5,5,5.5,6,6.5,7];
  const seek=async(t)=>{ state.playhead=t; await Promise.all(collectDrawnVideoClips(state.clips,state.lanes,t,0,[]).map(({c,m,local})=>vinstSeek(c,m,local))); };
  for(const t of ts) await seek(t);                       // deja los decodificadores donde toca
  const soloRender=[]; for(const t of ts){ state.playhead=t; const a=performance.now(); render(); gl.finish(); soloRender.push(performance.now()-a); }
  const conSeek=[]; for(const t of ts){ const a=performance.now(); await seek(t); render(); gl.finish(); conSeek.push(performance.now()-a); }
  const med=(x)=>{const s=x.slice().sort((u,v)=>u-v); return Math.round(s[Math.floor(s.length/2)]);};
  return { capas:collectDrawnVideoClips(state.clips,state.lanes,5,0,[]).length,
           soloComposite:med(soloRender), completo:med(conSeek) }; })()`);
console.log('capas dibujadas: '+r.capas);
console.log('solo el composite (lo que el cache PUEDE ahorrar): '+r.soloComposite+' ms');
console.log('scrub completo (seek + composite):                 '+r.completo+' ms');
console.log('=> techo del render-ahead: '+Math.round(100*r.soloComposite/Math.max(1,r.completo))+'% del coste');
ws.close();
