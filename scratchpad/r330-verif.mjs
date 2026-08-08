/* [R330] El contexto de la secuencia que se compone — del inventario (render/compositor).
     1 · `_zsortSize` (el tunel se dibuja de lejos a cerca) lo ponia SOLO `prepNests`, al entrar en un nido. Un
         tunel ABIERTO EN SU PROPIA PESTANA se componia sin el, en orden de pista: la misma secuencia se veia de
         una forma editandola y de otra dentro de su padre. 1b es el control: una secuencia normal no ordena.
     2 · La COBERTURA del domo era el unico dato del contexto que `prepNests` no cambiaba al entrar en el nido,
         asi que un nido de 220 grados compuesto dentro de un padre de 180 deformaba sus clips con la del PADRE
         (`curCovDeg` lee `state.seqCov`). Se mide espiando `composite`: la llamada del nido tiene que ver 220 y
         la del master 180, y al salir tiene que quedar restaurada.

     3 · El tejido barajado rota el medio EFECTIVO de cada elemento (`mediaEfId`) para que, al volver el diente
         de sierra, el vecino no ensene la misma imagen. El compositor dibujaba el rotado, pero el piloto de
         decodificadores pedia el ORIGINAL: en video la rotacion no hacia NADA -se dibujaba el medio rotado con
         los fotogramas del otro-, y en imagenes si funcionaba, asi que el fallo solo salia con tejidos de video.
         3b es el control: SIN tejido el medio efectivo es el de siempre, o el decodificador se reconstruiria en
         cada fotograma.

   Se conduce por `render()` entero, no llamando a las funciones del arreglo: lo que se comprueba es el contexto
   REAL con el que se compone cada cosa. El espia se quita en un finally.

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r330-verif.mjs
*/
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const p=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise(r=>{const i=++id;p.set(i,m=>r(m.result&&m.result.exceptionDetails?('EXC '+(m.result.exceptionDetails.exception?.description||'').slice(0,80)):(m.result&&m.result.result&&m.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true,timeout:60000}}));});

/* el espia: apunta el contexto con el que entra CADA composite de un render completo */
const ESPIA=`
  const orig=composite; const visto=[];
  composite=function(t2,size,opaque,fill){ visto.push({cov:state.seqCov,zs:!!_zsortSize,plano:!!_drawFlat,size:size||null}); return orig.apply(this,arguments); };
  try{ render(); } finally { composite=orig; }`;

console.log('');
console.log('R330 - el contexto de la secuencia que se compone');
console.log('');

console.log('1) un tunel abierto en SU pestana se ordena de lejos a cerca');
const r1 = await ev(`(async()=>{ try{
  await newProject('dome',2048,2048,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const as=activeSeq(); as.comp={id:1,kind:'tunnel',spin:0,shuffle:false,rand:[]};
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#888',LV,0,4,{x:0,y:0,scale:100});
  state.playhead=1;
  ${ESPIA}
  const master=visto[visto.length-1]||null;
  return JSON.stringify({llamadas:visto.length, ordenaPorTamano:!!(master&&master.zs)});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r1);

console.log('1b) una secuencia normal NO ordena por tamano (control)');
const r1b = await ev(`(async()=>{ try{
  await newProject('dome',2048,2048,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#888',LV,0,4,{x:0,y:0,scale:100});
  state.playhead=1;
  ${ESPIA}
  const master=visto[visto.length-1]||null;
  return JSON.stringify({llamadas:visto.length, ordenaPorTamano:!!(master&&master.zs)});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r1b);

console.log('2) un nido de 220 grados dentro de un padre de 180 se compone con LA SUYA');
const r2 = await ev(`(async()=>{ try{
  await newProject('dome',2048,2048,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const padre=activeSeq();
  const hijo=newSeqMedia('Hija 220',state.fps||30,2048,2048,null,null,'dome',220);
  state.media.push(hijo); state.openSeqs.push(hijo.id);
  switchSeq(hijo.id);
  const LVh=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#8f8',LVh,0,6,{x:0,y:0,scale:100});
  switchSeq(padre.id);
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoPlace(hijo,LV,0,4,{});
  state.playhead=1;
  const cid=state.clips[state.clips.length-1].id;
  ${ESPIA}
  const master=visto[visto.length-1]||null;
  const nido=visto.length>1?visto[0]:null;
  return JSON.stringify({llamadas:visto.length, covDelNido:nido?nido.cov:null, covDelMaster:master?master.cov:null,
    covTrasElRender:state.seqCov, elNidoUsaLaSuya: !!(nido&&nido.cov===220), restaurada: state.seqCov===180,
    elMasterSigue180: !!(master&&master.cov===180)});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r2);

console.log('3) con tejido de video, el decodificador sigue a la rotacion');
const r3 = await ev(`(async()=>{ try{
  await newProject('dome',2048,2048,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const A={id:880001,kind:'video',name:'A',path:'C:/no/A.mp4',srcUrl:'file:///C:/no/A.mp4',dur:60,w:1920,h:1080,fps:30,color:'#888'};
  const B={id:880002,kind:'video',name:'B',path:'C:/no/B.mp4',srcUrl:'file:///C:/no/B.mp4',dur:60,w:1920,h:1080,fps:30,color:'#888'};
  state.media.push(A,B);
  const nl=defLanes(); const LN=nl.findIndex(l=>l.kind!=='audio');
  const mk=(id,mid,x)=>({id,lane:LN,mediaId:mid,start:0,dur:20,inP:0,speed:1,
    props:{az:0,el:35,size:55,x,y:0,scale:100,opacity:100},
    anim:[{param:'x',mode:'saw',speed:0.5,amp:40,phase:0,on:true}],kf:{}});
  const nc=[mk(880101,A.id,-20),mk(880102,B.id,20)];
  const nido=newSeqMedia('Tejido',30,2048,2048,nc,nl,'dome',180);
  nido.comp={id:9,kind:'weave',shuffle:true,bands:1,count:2,motion:'x',rand:[]};
  state.media.push(nido);
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoPlace(nido,LV,0,10,{});
  state.playhead=3; wvPrep(nido);
  const rot=nc.map(c=>mediaEfId(c,3));
  const drv=collectDrawnVideoClips(state.clips,state.lanes,3,0,[]);
  const porClip={}; for(const x of drv)porClip[x.c.id]=x.m.id;
  return JSON.stringify({rotaDeVerdad: rot[0]!==nc[0].mediaId && rot[1]!==nc[1].mediaId,
    rotados:rot, pilotados:[porClip[880101]||null,porClip[880102]||null],
    coinciden: porClip[880101]===rot[0] && porClip[880102]===rot[1]});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r3);

console.log('3b) SIN tejido el medio efectivo no cambia nunca (control anti-reconstruccion)');
const r3b = await ev(`(async()=>{ try{
  await newProject('dome',2048,2048,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const A={id:880003,kind:'video',name:'A',path:'C:/no/A.mp4',srcUrl:'file:///C:/no/A.mp4',dur:60,w:1920,h:1080,fps:30,color:'#888'};
  state.media.push(A);
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  const c={id:880201,lane:LV,mediaId:A.id,start:0,dur:20,inP:0,speed:1,
    props:{az:0,el:35,size:55,x:0,y:0,scale:100,opacity:100},
    anim:[{param:'x',mode:'saw',speed:0.5,amp:40,phase:0,on:true}],kf:{}};
  state.clips.push(c);
  let cambios=0; for(let i=0;i<40;i++){ if(mediaEfId(c,i*0.25)!==A.id)cambios++; }
  return JSON.stringify({muestras:40, vecesQueCambia:cambios, estable:cambios===0});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r3b);

const malas=[];
const J=s=>{ try{ return JSON.parse(s); }catch(e){ return {err:String(s).slice(0,90)}; } };
const o1=J(r1),o1b=J(r1b),o2=J(r2),o3=J(r3),o3b=J(r3b);
for(const [n,o] of [['1',o1],['1b',o1b],['2',o2],['3',o3],['3b',o3b]]) if(o.err) malas.push('sonda '+n+' rota: '+o.err);
if(!o1.err&&!o1.ordenaPorTamano) malas.push('un tunel abierto en su pestana NO se ordena de lejos a cerca');
if(!o1b.err&&o1b.ordenaPorTamano) malas.push('una secuencia normal ordena por tamano: el contexto se pega');
if(!o2.err){ if(o2.llamadas<2) malas.push('el nido no llego a componerse: la sonda no mide nada');
  if(!o2.elNidoUsaLaSuya) malas.push('el nido se compone con la cobertura del PADRE ('+o2.covDelNido+' en vez de 220)');
  if(!o2.elMasterSigue180) malas.push('el master se compone con la cobertura del nido');
  if(!o2.restaurada) malas.push('la cobertura no se restaura al salir del nido'); }
if(!o3.err){ if(!o3.rotaDeVerdad) malas.push('el tejido no llego a rotar: la sonda no mide nada');
  if(!o3.coinciden) malas.push('el decodificador sigue pilotando el medio ORIGINAL ('+o3.pilotados+' en vez de '+o3.rotados+')'); }
if(!o3b.err&&!o3b.estable) malas.push('sin tejido el medio efectivo cambia: el decodificador se reconstruiria solo');
console.log('');
for(const m of malas) console.log('   *** '+m);
console.log(malas.length ? ('*** '+malas.length+' FALLOS') : 'cada secuencia se compone con SU contexto, y el decodificador sigue a la fuente');
ws.close(); process.exit(malas.length?1:0);
