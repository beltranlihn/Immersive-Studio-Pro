/* [R297] El tejido dentro de un compose LOOPEADO en la linea de tiempo. Beltran ve que "el randomize se
   resetea en cada vuelta". Hay dos cosas que podrian reiniciarse y conviene separarlas antes de tocar nada:
     A) la ASIGNACION de fuente a cada elemento (el shuffle) — deberia ser fija, no depender del tiempo;
     B) el MOVIMIENTO del tejido — deberia seguir corrido al cruzar el salto del bucle.
   Se mide a los dos lados del salto y se compara con lo que habria pasado SIN bucle, que es la referencia. */
import http from 'http';
const t=await new Promise((r2,j)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',j);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||'')):res(r.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };

await ev("(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()");
await new Promise(r=>setTimeout(r,2000));

const r=await ev(`(async function(){
  for(let k=0;k<3;k++) state.media.push({id:uid(),name:'c'+k+'.mp4',kind:'video',w:1920,h:1080,dur:8,fps:30,color:'#888',path:'x'+k,folder:null});
  renderMedia();
  const ids=state.media.filter(m=>m.kind==='video').map(m=>m.id);
  /* Un tejido con barajado y con movimiento, que es el caso que describe. */
  const g={id:77,kind:'weave',mediaIds:ids,mediaId:ids[0],count:12,shuffle:true,strips:4,bandW:100,gap:0,
           speed:0.25,rotSpeed:0,rotDir:'same',lay:'woven',mask:'none',maskScale:100,rand:[],jitter:0,size:40,el:30};
  const lay=weaveLayout(g);
  const out={ elementos:lay.length, fuentes:lay.map(p=>p._src).join(',') };

  /* El compose, como clip LOOPEADO en la linea de tiempo. */
  const nest=state.media.find(isSeqMedia);
  const c={ id:uid(), mediaId:nest.id, lane:0, start:0, dur:12, inP:0, loop:true, loopLen:3, props:{}, kf:{} };
  state.clips.push(c);

  /* El desplazamiento del tejido en el instante t, tal como lo ve el motor. */
  const L=3;                                  /* largo del bucle */
  const medir=tt=>{ const mods=compWeaveAnim(g,lay[0]); const m=mods.find(x=>x.mode==='saw'); if(!m)return null;
    const at=animTime(tt);
    /* diente de sierra: fase dentro del ciclo */
    const per=m.amp/Math.max(1e-6,m.speed*m.amp/m.amp);
    return { at, saw:m.speed, amp:m.amp }; };
  out.tieneSaw=!!compWeaveAnim(g,lay[0]).find(x=>x.mode==='saw');

  /* Lo que de verdad importa: el tiempo de animacion a los dos lados del salto. Si _animNido hace su trabajo,
     animTime debe seguir CRECIENDO al cruzar de 2,99 a 3,01 -segunda vuelta-, no volver a cerca de cero. */
  const leer=tt=>{ prepNests(state.clips,tt,0); const a=animTime(tt); _animNido=0; return a; };
  out.antes=leer(2.95); out.despues=leer(3.05); out.masTarde=leer(6.05);
  state.clips=state.clips.filter(x=>x.id!==c.id);
  return out; })()`);

console.log('elementos del tejido: '+r.elementos);
console.log('fuente por elemento: '+r.fuentes);
console.log('lleva movimiento (diente de sierra): '+r.tieneSaw);
console.log('tiempo de animacion  en 2,95 -> '+r.antes.toFixed(3)+'   en 3,05 (2a vuelta) -> '+r.despues.toFixed(3)+'   en 6,05 (3a) -> '+r.masTarde.toFixed(3));
const fs2=r.fuentes.split(',').map(Number);
if(new Set(fs2).size<2) mal('el barajado no reparte: todas las fuentes iguales');
if(!r.tieneSaw) mal('el tejido no lleva movimiento, asi que no hay nada que continuar');
/* La prueba de fuego: al cruzar el salto el tiempo debe SEGUIR, no reiniciarse. */
if(r.despues<r.antes) mal('el tiempo de animacion RETROCEDE al cruzar el bucle ('+r.antes.toFixed(2)+' -> '+r.despues.toFixed(2)+'): el tejido se reinicia');
if(r.masTarde<r.despues) mal('en la tercera vuelta vuelve a retroceder');
if(Math.abs((r.despues-r.antes)-0.10)>0.02) mal('el salto no es continuo: entre 2,95 y 3,05 deberia avanzar 0,10 y avanza '+(r.despues-r.antes).toFixed(3));
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'el tejido sigue corrido al cruzar el bucle'));
ws.close(); process.exit(fallos?1:0);
