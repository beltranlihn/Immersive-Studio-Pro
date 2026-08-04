/* [R247d] Dentro de una tira: ningun clip puede cortarse con el siguiente. Mide el hueco/solape entre bordes
   consecutivos, en unidades de lienzo. 0 = borde con borde. Negativo = se cortan (lo que Beltran no quiere). */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await ev(`window.__bordes=function(T){ const nest=state.media.find(m=>m.kind==='nest'); if(!nest)return{err:1};
  const bakF=_drawFlat,bakA=_compAspect,bakC=_previewClock; _drawFlat=true; _compAspect=1; _previewClock=T;
  const tiras=new Map();
  for(const c of nest.nestClips){ const m=mediaById(c.mediaId); if(!m)continue;
    const pl=flatPlace(c,m,1,1);
    const eje=(c.anim&&c.anim[0])?c.anim[0].param:(Math.abs(pl.fc[0])<Math.abs(pl.fc[1])?'y':'x');
    const ix=(eje==='x')?0:1;                                  // eje de avance de la tira
    const semi=(ix===0)?(Math.abs(pl.fx[0])+Math.abs(pl.fy[0])):(Math.abs(pl.fx[1])+Math.abs(pl.fy[1]));
    const perp=(ix===0)?pl.fc[1]:pl.fc[0];
    const k=eje+':'+Math.round(perp*1000);
    if(!tiras.has(k))tiras.set(k,[]);
    tiras.get(k).push({c:pl.fc[ix]*100, s:semi*100}); }
  _drawFlat=bakF; _compAspect=bakA; _previewClock=bakC;
  let peorSolape=0, peorHueco=0, pares=0;
  for(const arr of tiras.values()){ arr.sort((a,b)=>a.c-b.c);
    for(let i=1;i<arr.length;i++){ const d=(arr[i].c-arr[i].s)-(arr[i-1].c+arr[i-1].s); // hueco entre bordes
      pares++; if(d<peorSolape)peorSolape=d; if(d>peorHueco)peorHueco=d; } }
  return { tiras:tiras.size, pares, peorSolape:+peorSolape.toFixed(3), peorHueco:+peorHueco.toFixed(3) }; };1`);
for(const [nom,cfg] of [
  ['tejido 5 · empaque 100', {bands:5,weaveMode:'weave',bandW:100,fit:'across',density:1,speed:0.1,speedV:0.1,motion:'alternate',interlace:true}],
  ['tejido 5 · a lo largo',  {bands:5,weaveMode:'weave',bandW:100,fit:'along', density:1,speed:0.1,speedV:0.1,motion:'alternate',interlace:true}],
  ['tejido 8 · ancho 60',    {bands:8,weaveMode:'weave',bandW:60, fit:'across',density:1,speed:0.1,speedV:0.1,motion:'same',interlace:true}],
  ['lineas 3 · empaque 70',  {bands:3,weaveMode:'h',    bandW:40, fit:'along', density:0.7,speed:0.1,motion:'same',interlace:false}],
]){
  await ev(`__monta(${JSON.stringify(cfg)})`); await wait(400);
  const a=await ev(`__bordes(0)`), b=await ev(`__bordes(2.4)`);
  console.log(nom.padEnd(24)+' tiras '+String(a.tiras).padStart(3)+
    '  quieto: solape '+String(a.peorSolape).padStart(7)+' hueco '+String(a.peorHueco).padStart(6)+
    '   |  en marcha: solape '+String(b.peorSolape).padStart(7)+' hueco '+String(b.peorHueco).padStart(6));
}
ws.close();
