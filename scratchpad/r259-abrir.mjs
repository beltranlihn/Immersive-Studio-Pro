/* [R259] ¿Que pasa exactamente al abrir el proyecto real? ¿Cuantas veces navega la pagina, y por que? */
import http from 'http';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let ws=null,id=0;const p=new Map();
async function conectar(){ for(let i=0;i<25;i++){ try{
  const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
  const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
  if(pg){ const w=new WebSocket(pg.webSocketDebuggerUrl); await new Promise((r,j)=>{w.onopen=r;w.onerror=j;});
    p.clear(); w.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}}; ws=w; return; } }catch(e){} await wait(700); } throw new Error('sin conexion'); }
await conectar();
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:600000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const ISP='C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro\\scratchpad\\aud8b-rito-copia.isp';
/* sello que sobrevive a la recarga: si cambia timeOrigin, hubo navegacion */
const sello=async()=>{ try{ return await ev(`Math.round(performance.timeOrigin)`); }catch(e){ return 'CAIDA'; } };
console.log('timeOrigin antes: '+await sello());
await ev(`(function(){ window.__gl=[]; addEventListener('error',e=>__gl.push('err: '+e.message)); 
  glc.addEventListener('webglcontextlost',()=>{ try{localStorage.setItem('__ctxlost','1');}catch(_){}}); return 1; })()`);
ev(`(async function(){ state.dirty=false; await openProjectPath('${ISP}',true); })()`).catch(()=>{});
for(let s=2;s<=24;s+=4){ await wait(4000); const t=await sello();
  console.log('  +'+s+'s  timeOrigin: '+t+(t==='CAIDA'?'  (conexion caida -> reconectando)':''));
  if(t==='CAIDA'){ await conectar(); } }
const fin=await ev(`(function(){ return { medios:state.media.length, clips:state.clips.length,
  activa:(state.media.find(m=>m.id===state.activeSeqId)||{}).name, faltan:state.media.filter(m=>m.missing).length,
  ctxLost:localStorage.getItem('__ctxlost')||'no', errs:(window.__gl||[]).slice(0,4) }; })()`);
console.log('\nestado final: '+JSON.stringify(fin));
ws.close();
