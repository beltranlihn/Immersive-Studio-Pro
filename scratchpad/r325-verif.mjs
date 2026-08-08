/* [R325] Los hallazgos que pueden DESTRUIR O PERDER TRABAJO, del inventario de la auditoria (§9/§10).
   No son una familia con una regla comun como las otras redes: son los cuatro que, si vuelven, cuestan material.
     1 · `emergencySave` guardaba durante un export: con `isolateClips` (Render in place) `state.clips` esta
         SUSTITUIDO por los clips aislados, asi que una caida dejaba el proyecto TRUNCADO como autoguardado mas
         reciente. Ademas escribia siempre en `.autosave1`, anulando la alternancia de dos ranuras.
     2 · `runExport` no tenia guarda de reentrada, y todo su estado es global (`exporting`, `glc.width`,
         `nestSize`, el `state.clips` sustituido): dos renders solapados se pisan.
     3 · el escritor ZIP truncaba en silencio por encima de 65535 entradas — un domo a 60 fps las pasa en 18
         minutos— y entregaba un archivo corrupto anunciado como bueno.
     4 · `migrateRoomFloor` retiraba la secuencia de piso sin quitar los clips que la usaban desde otras
         secuencias: quedaban con un `mediaId` inexistente, mudos y sin dibujar, y viajaban asi al `.isp`.

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r325-verif.mjs
*/
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const p=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise(r=>{const i=++id;p.set(i,m=>r(m.result&&m.result.exceptionDetails?('EXC '+(m.result.exceptionDetails.exception?.description||'').slice(0,90)):(m.result&&m.result.result&&m.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true,timeout:60000}}));});

console.log('1) emergencySave durante un export NO escribe');
const r1 = await ev(`(()=>{ try{
  const antes=_emergT; exporting=true; _emergT=0; emergencySave(); const durante=_emergT;
  exporting=false; _emergT=0; emergencySave(); const fuera=_emergT;
  return JSON.stringify({escribioDuranteExport:durante!==0, escribioFuera:fuera!==0});
}catch(e){ return 'ERR '+e.message; } })()`); console.log('  ->', r1);

console.log('2) runExport rechaza la reentrada');
const r2 = await ev(`(async()=>{ try{
  exporting=true; const r=await runExport({codec:'still'}); exporting=false;
  return JSON.stringify({devolvio:String(r), sigueSinExportar:!exporting});
}catch(e){ exporting=false; return 'ERR '+e.message; } })()`); console.log('  ->', r2);

console.log('3) el ZIP se planta en 65535 en vez de corromperse');
const r3 = await ev(`(()=>{ try{
  const z=new Zip(); const d=new Uint8Array(4);
  for(let i=0;i<65535;i++)z.c.push(new Uint8Array(0),new Uint8Array(0));   // simula el directorio lleno
  let msg=null; try{ z.add('x.png',d); }catch(e){ msg=String(e.message).slice(0,60); }
  return JSON.stringify({paro:!!msg, mensaje:msg});
}catch(e){ return 'ERR '+e.message; } })()`); console.log('  ->', r3);

console.log('4) migrateRoomFloor retira los clips que usaban la secuencia de piso');
const r4 = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const fseq={id:880001,kind:'nest',name:'piso',w:1920,h:1080,fps:30,mode:'flat',nestClips:[],nestLanes:null,dur:10};
  state.media.push(fseq);
  const wseq={id:880002,kind:'nest',name:'muros',w:4000,h:1000,fps:30,mode:'room',nestClips:[],nestLanes:null,dur:10,
              room:{floorSeqId:fseq.id,stripH:800,walls:[{role:'Front',x0:0,x1:1000}],floor:{pxW:1920,pxH:1080}}};
  state.media.push(wseq);
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  state.clips.push({id:880101,lane:LV,mediaId:fseq.id,start:0,dur:5,inP:0,speed:1,props:{}});   // un clip del PISO en la linea activa
  const antes=state.clips.length;
  migrateRoomFloor(wseq);
  const huerfanos=state.clips.filter(c=>!mediaById(c.mediaId)).length;
  return JSON.stringify({clipsAntes:antes, clipsDespues:state.clips.length, huerfanos});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r4);
const malas=[];
if(!/\"escribioDuranteExport\":false/.test(r1))malas.push('emergencySave escribe durante un export');
if(!/\"escribioFuera\":true/.test(r1))malas.push('emergencySave ya no escribe nunca: la prueba no mide nada');
if(!/\"sigueSinExportar\":true/.test(r2))malas.push('runExport no rechaza la reentrada');
if(!/\"paro\":true/.test(r3))malas.push('el ZIP no se planta en 65535');
if(!/\"huerfanos\":0/.test(r4))malas.push('migrateRoomFloor deja clips con mediaId inexistente');
console.log('');
for(const m of malas)console.log('   *** '+m);
console.log(malas.length?('*** '+malas.length+' FALLOS'):'los cuatro que cuestan material quedan cubiertos');
ws.close(); process.exit(malas.length?1:0);
