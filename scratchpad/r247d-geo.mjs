import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
console.log('4 lineas horizontales al 50% de ancho: donde cae cada tira en el eje Y (lienzo -100..100)');
await ev(`__monta({bands:4,weaveMode:'h',bandW:50,fit:'across',density:1,speed:0.1,motion:'same',interlace:false})`);
await wait(400);
const r=await ev(`(function(){ const nest=state.media.find(m=>m.kind==='nest');
  const bakF=_drawFlat,bakA=_compAspect; _drawFlat=true; _compAspect=1;
  const tiras=new Map();
  for(const c of nest.nestClips){ const m=mediaById(c.mediaId); const pl=flatPlace(c,m,1,1);
    const hy=Math.abs(pl.fx[1])+Math.abs(pl.fy[1]);   // semialto de la CAJA envolvente
    const cy=pl.fc[1];
    const k=Math.round(cy*1000)/1000;
    if(!tiras.has(k)) tiras.set(k,{centro:+(cy*100).toFixed(1), medioAlto:+(hy*100).toFixed(1), n:0});
    tiras.get(k).n++; }
  _drawFlat=bakF; _compAspect=bakA;
  return [...tiras.values()].sort((a,b)=>a.centro-b.centro); })()`);
for(const t of r) console.log('   centro y='+String(t.centro).padStart(7)+'   ocupa '+
  (t.centro-t.medioAlto).toFixed(1)+' … '+(t.centro+t.medioAlto).toFixed(1)+'   ('+t.n+' clips)');
console.log('\nesperado con 4 tiras al 50%: paso 50, grosor 25 → tiras en -87..-62, -37..-12, 12..37, 62..87');
ws.close();
