/* [R247d] Grosor REAL de cada tira (lado que cruza) por familia, y largo de cada clip dentro de ella.
   Si el grosor varia de una tira a otra, es un fallo: deberia ser el mismo para todas. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await ev(`__monta({bands:5,weaveMode:'weave',bandW:60,fit:'across',density:1,speed:0.1,speedV:0.1,motion:'alternate',interlace:true})`);
await wait(500);
const r=await ev(`(function(){ const nest=state.media.find(m=>m.kind==='nest');
  const bakF=_drawFlat,bakA=_compAspect; _drawFlat=true; _compAspect=1;
  const tiras=new Map();
  for(const c of nest.nestClips){ const m=mediaById(c.mediaId); if(!m)continue;
    const pl=flatPlace(c,m,1,1);
    const eje=(c.anim&&c.anim[0])?c.anim[0].param:'x';
    const bw=(Math.abs(pl.fx[0])+Math.abs(pl.fy[0]))*100*2;   // ancho de caja, unidades de lienzo
    const bh=(Math.abs(pl.fx[1])+Math.abs(pl.fy[1]))*100*2;   // alto de caja
    const cruza=(eje==='x')?bh:bw, largo=(eje==='x')?bw:bh;   // 'x' = tira horizontal → cruza en vertical
    const perp=(eje==='x')?pl.fc[1]:pl.fc[0];
    const k=eje+'@'+Math.round(perp*1000);
    if(!tiras.has(k))tiras.set(k,{eje,fuente:m.name,cruza:+cruza.toFixed(2),largos:new Set()});
    tiras.get(k).largos.add(+largo.toFixed(2)); }
  _drawFlat=bakF; _compAspect=bakA;
  return [...tiras.values()].map(t=>({eje:t.eje,fuente:t.fuente,cruza:t.cruza,largos:[...t.largos]})); })()`);
console.log('5 tiras por familia, ancho de tira 60% (paso 40 → grosor esperado 24 en TODAS)');
for(const t of r) console.log('  '+(t.eje==='x'?'↔':'↕')+'  '+t.fuente.padEnd(6)+
  '  cruza '+String(t.cruza).padStart(6)+'   largo de clip '+JSON.stringify(t.largos));
const anchos=[...new Set(r.map(t=>t.cruza))];
console.log('\ngrosores distintos encontrados: '+JSON.stringify(anchos)+(anchos.length===1?'  → CONSTANTE, correcto':'  → VARIABLE, es un fallo'));
ws.close();
