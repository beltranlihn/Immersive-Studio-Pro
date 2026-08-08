/* [R334] Pestanyas, duracion del padre, deshacer muerto y un analisis que se reintentaba solo.
     1 · `toggleDisable` sobre un rango SIN clips apilaba una foto de deshacer y luego salia por la puerta: el
         siguiente Ctrl+Z parecia no hacer nada. Misma familia que el locator de R328.
     2 · Cambiar de pestanya y cerrar una pestanya son cambios del proyecto (`activeSeqId` y `openSeqs` viajan
         en el .isp) y no marcaban sucio; cerrar la activa ademas dejaba el titulo con el nombre de la
         secuencia que se acababa de cerrar. 2b es el control: el export cambia de secuencia para hornear el
         piso de una sala y la devuelve — eso NO debe ensuciar nada.
     3 · Al borrar una secuencia se le quitaban sus clips al padre pero no se recalculaba `m.dur` del padre, que
         es un dato GUARDADO: un clip del abuelo podia seguir estirado sobre contenido que ya no existe.
     4 · Un analisis de bandas que falla dejaba `m.bands` en null, y como esto se llama desde cada repintado del
         panel reactivo, la FFT entera se relanzaba una y otra vez. 4b: reimportar el medio limpia el fallo.

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r334-verif.mjs
*/
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const p=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise(r=>{const i=++id;p.set(i,m=>r(m.result&&m.result.exceptionDetails?('EXC '+(m.result.exceptionDetails.exception?.description||'').slice(0,80)):(m.result&&m.result.result&&m.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true,timeout:60000}}));});

console.log('');
console.log('R334 - pestanyas, duracion del padre y deshacer muerto');
console.log('');

console.log('1) apagar un rango SIN clips no consume historial');
const r1 = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#888',LV,0,2,{x:0,y:0,scale:100});
  const fotos=()=>_ustk().u.length;
  state.tl.selA=20; state.tl.selB=30; state.tl.selLanes=[LV];   // un tramo vacio, lejos del clip
  const antes=fotos(); toggleDisable(); const trasVacio=fotos()-antes;
  state.tl.selA=0; state.tl.selB=2;                              // ahora SI hay clip (control)
  const antes2=fotos(); toggleDisable(); const trasLleno=fotos()-antes2;
  return JSON.stringify({trasVacio, trasLleno, sinFotoMuerta:trasVacio===0, elCasoRealSiGuarda:trasLleno===1});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r1);

console.log('2) cambiar y cerrar pestanya ensucian el proyecto; el export NO');
const r2 = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const a=activeSeq();
  /* La segunda es de DOMO a proposito: el rotulo lleva el MODO de la secuencia activa (2D / Domo inmersivo /
     Sala 360), asi que con dos secuencias planas no habria nada que ver. Y vive en #projTitle, no en
     document.title. */
  const b=newSeqMedia('Segunda',30,2048,2048,null,null,'dome',180);
  state.media.push(b); state.openSeqs.push(b.id);
  const rotulo=()=>{ const el=document.getElementById('projTitle'); return el?el.textContent:''; };
  state.dirty=false; switchSeq(b.id);              const sucioAlCambiar=!!state.dirty;
  state.dirty=false; switchSeq(a.id,true);          const sucioSilencioso=!!state.dirty;
  state.dirty=false; switchSeq(b.id);
  const tituloAntes=rotulo();
  state.dirty=false; closeSeqTab(b.id);             const sucioAlCerrar=!!state.dirty;
  const tituloDespues=rotulo();
  return JSON.stringify({sucioAlCambiar, sucioSilencioso, sucioAlCerrar,
    tituloAntes, tituloDespues, tituloCambia: tituloAntes!==tituloDespues, activaTrasCerrar:(activeSeq()||{}).name,
    bien: sucioAlCambiar&&!sucioSilencioso&&sucioAlCerrar});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r2);

console.log('3) borrar una secuencia anidada recalcula la duracion del padre');
const r3 = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const padre=activeSeq();
  const hija=newSeqMedia('Hija',30,1920,1080,null,null,'flat',180);
  state.media.push(hija); state.openSeqs.push(hija.id);
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#888',LV,0,3,{x:0,y:0,scale:100});     // 3 s propios del padre
  _demoPlace(hija,LV,4,9,{});                                   // + un clip de la hija que llega a 13 s
  padre.dur=seqDur(padre);
  const durAntes=padre.dur;
  deleteSequenceMedia(hija.id,true);
  const p2=mediaById(padre.id);
  return JSON.stringify({durAntes:+durAntes.toFixed(2), durDespues:+p2.dur.toFixed(2),
    seqDurReal:+seqDur(p2).toFixed(2), cuadra:Math.abs(p2.dur-seqDur(p2))<0.01, haBajado:p2.dur<durAntes-0.5});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r3);

console.log('4) un analisis de bandas que falla no se reintenta solo');
const r4 = await ev(`(async()=>{ try{
  const orig=computeBands; let n=0;
  computeBands=function(){ n++; return Promise.reject(new Error('prueba')); };
  const m={id:970001,kind:'audio',name:'x',dur:10,buffer:{fake:1}};
  try{
    armMediaBands(m,m.buffer); await new Promise(r=>setTimeout(r,60));
    const trasElFallo=n;
    armMediaBands(m,m.buffer); armMediaBands(m,m.buffer); await new Promise(r=>setTimeout(r,60));
    const trasInsistir=n;
    m.bands=null; m._bandsBusy=false; m._bandsFail=false;   // lo que hace el reset del medio
    armMediaBands(m,m.buffer); await new Promise(r=>setTimeout(r,60));
    return JSON.stringify({trasElFallo, trasInsistir, trasReimportar:n, marcado:!!m._bandsFail,
      noSeReintenta:trasInsistir===trasElFallo, elResetLoLimpia:n===trasInsistir+1});
  } finally { computeBands=orig; }
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r4);

const malas=[];
const J=s=>{ try{ return JSON.parse(s); }catch(e){ return {err:String(s).slice(0,90)}; } };
const o1=J(r1),o2=J(r2),o3=J(r3),o4=J(r4);
for(const [n,o] of [['1',o1],['2',o2],['3',o3],['4',o4]]) if(o.err) malas.push('sonda '+n+' rota: '+o.err);
if(!o1.err){ if(!o1.sinFotoMuerta) malas.push('apagar un rango vacio sigue consumiendo historial');
  if(!o1.elCasoRealSiGuarda) malas.push('apagar clips de verdad ya no se puede deshacer: regresion'); }
if(!o2.err){ if(!o2.sucioAlCambiar) malas.push('cambiar de pestanya no marca el proyecto como sucio');
  if(o2.sucioSilencioso) malas.push('el cambio de secuencia del export ensucia el proyecto');
  if(!o2.sucioAlCerrar) malas.push('cerrar una pestanya no marca el proyecto como sucio');
  if(!o2.tituloCambia) malas.push('cerrar la pestanya activa deja el titulo de la secuencia cerrada'); }
if(!o3.err){ if(!o3.haBajado) malas.push('la sonda no mide nada: la duracion no deberia haber bajado');
  if(!o3.cuadra) malas.push('el padre conserva la duracion vieja ('+o3.durDespues+' con contenido de '+o3.seqDurReal+')'); }
if(!o4.err){ if(!o4.marcado||!o4.noSeReintenta) malas.push('el analisis fallido se reintenta en cada llamada ('+o4.trasInsistir+' intentos)');
  if(!o4.elResetLoLimpia) malas.push('tras reimportar el medio ya no se vuelve a analizar'); }
console.log('');
for(const m of malas) console.log('   *** '+m);
console.log(malas.length ? ('*** '+malas.length+' FALLOS') : 'sin fotos muertas, con el proyecto sucio cuando toca y sin reintentos en bucle');
ws.close(); process.exit(malas.length?1:0);
