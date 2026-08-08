/* [R338] Las diez de la segunda revision — casi todas arreglos de R336/R337 que se quedaron a medias.
   Cada caso esta escrito para FALLAR si se revierte su arreglo.

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r338-verif.mjs
*/
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const p=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise(r=>{const i=++id;p.set(i,m=>r(m.result&&m.result.exceptionDetails?('EXC '+(m.result.exceptionDetails.exception?.description||'').slice(0,90)):(m.result&&m.result.result&&m.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true,timeout:60000}}));});

console.log('');
console.log('R338 - las diez de la segunda revision');
console.log('');

console.log('1) un disparo invertido SIN onsets analizados no se dispara');
const r1 = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#888',LV,0,4,{x:0,y:0,scale:100});
  const c=state.clips[state.clips.length-1];
  const fx={id:1,type:'glow',on:true,band:'bass',mode:'trigger',int:0,amt:100,atk:8,rel:130,curve:50,spring:0,inv:true};
  const vacio=new Float32Array(360);
  /* DENTRO del clip -la guarda de R336 pasa- pero sin onsets: el camino que se quedo fuera. */
  _arCache={clip:c, fps:90, onsets:{bass:[]}, beats:[], bpm:0, beat0:0,
            raw:{bass:vacio}, bass:vacio, mid:vacio, treble:vacio, bright:vacio};
  _arTime=2; const sinOnsets=fxModLevel(fx);
  _arCache.onsets={bass:[3.0]}; _arCache.beats=[3.0];
  _arTime=1; const antesDelPrimero=fxModLevel(fx);   // dentro del clip pero antes del primer golpe
  _arTime=3.01; const trasElGolpe=fxModLevel(fx);    // pasado el ataque -> disparo alto -> invertido ~0
  _arTime=3.9;  const cayendo=fxModLevel(fx);        // ya caido -> invertido ~1
  _arCache=null;
  return JSON.stringify({sinOnsets:+sinOnsets.toFixed(3), antesDelPrimero:+antesDelPrimero.toFixed(3),
    trasElGolpe:+trasElGolpe.toFixed(3), cayendo:+cayendo.toFixed(3),
    sinDatosEsCero: sinOnsets===0 && antesDelPrimero===0,
    conDatosSigueInvirtiendo: trasElGolpe<0.2 && cayendo>0.8});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r1);

console.log('2) prepNests y el piloto de decodificadores piden el MISMO medio');
const r2 = await ev(`(async()=>{ try{
  await newProject('dome',2048,2048,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const A={id:940001,kind:'video',name:'A',path:'C:/no/A.mp4',srcUrl:'file:///C:/no/A.mp4',dur:60,w:1920,h:1080,fps:30};
  const B={id:940002,kind:'video',name:'B',path:'C:/no/B.mp4',srcUrl:'file:///C:/no/B.mp4',dur:60,w:1920,h:1080,fps:30};
  state.media.push(A,B);
  const nl=defLanes(); const LN=nl.findIndex(l=>l.kind!=='audio');
  const mk=(id,mid,x)=>({id,lane:LN,mediaId:mid,start:0,dur:20,inP:0,speed:1,
    props:{az:0,el:35,size:55,x,y:0,scale:100,opacity:100},
    anim:[{param:'x',mode:'saw',speed:0.5,amp:40,phase:0,on:true}],kf:{}});
  const nc=[mk(940101,A.id,-20),mk(940102,B.id,20)];
  const nido=newSeqMedia('Tejido',30,2048,2048,nc,nl,'dome',180);
  nido.comp={id:9,kind:'weave',shuffle:true,bands:1,count:2,motion:'x',rand:[]};
  state.media.push(nido);
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoPlace(nido,LV,0,10,{});
  state.playhead=3; wvPrep(nido);
  const rot=nc.map(c=>mediaEfId(c,3));
  /* Se espia a quien resuelve el medio dentro de prepNests: tiene que coincidir con el rotado. */
  const vistos=[]; const orig=mediaById;
  mediaById=function(q){ vistos.push(q); return orig(q); };
  try{ prepNests(nido.nestClips,3,1); } finally { mediaById=orig; }
  const pideRotado = vistos.indexOf(rot[0])>=0 && vistos.indexOf(rot[1])>=0;
  const drv=collectDrawnVideoClips(state.clips,state.lanes,3,0,[]);
  const porClip={}; for(const x of drv)porClip[x.c.id]=x.m.id;
  return JSON.stringify({rotaDeVerdad: rot[0]!==nc[0].mediaId, rotados:rot,
    prepNestsPideElRotado:pideRotado,
    pilotados:[porClip[940101]||null,porClip[940102]||null],
    coinciden: porClip[940101]===rot[0] && porClip[940102]===rot[1]});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r2);

console.log('3) migrar el piso de una sala tambien suelta la cache reactiva');
const r3 = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#888',LV,0,4,{x:0,y:0,scale:100});
  const c=state.clips[state.clips.length-1];
  ensureReactive().srcClipId=c.id;
  const v8=new Float32Array(8);
  _arCache={clip:c, fps:30, raw:{bass:v8}, bass:v8, mid:v8, treble:v8, bright:v8, beats:[], bpm:0, beat0:0};
  /* Se llama al helper y se filtra a mano, que es EXACTAMENTE lo que hace migrateRoomFloor. */
  _soltarRecursosClips([c.id]);
  const banderaTrasSoltar=_arReataPend;
  state.clips=state.clips.filter(x=>x.id!==c.id);
  _reataReactivo();
  return JSON.stringify({banderaTrasSoltar, banderaFinal:_arReataPend,
    sigueAgarrada: !!(_arCache&&_arCache.clip&&_arCache.clip.id===c.id),
    suelta: banderaTrasSoltar===true && _arReataPend===false && !(_arCache&&_arCache.clip&&_arCache.clip.id===c.id)});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r3);

console.log('4) al mover la curva de Mix, la pista la SIGUE en vez de perderla');
const r4 = await ev(`(async()=>{ try{
  await newProject('dome',2048,2048,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#888',LV,0,5,{x:0,y:0,scale:100});
  const c=state.clips[state.clips.length-1]; state.selId=c.id; state.selIds=[c.id];
  c.anim=[{on:true,param:'x',mode:'wave',speed:1,amp:20}];
  c.kf=c.kf||{}; c.kf['mot:x:mix']=[{t:0,v:0,e:'linear'},{t:2,v:100,e:'linear'}];
  state.lanes[LV]._autoP='mot:x:mix';
  renderInspector();
  const sel=document.querySelector('.aparam'); if(!sel) return JSON.stringify({err:'sin fila de Motion'});
  sel.value='y'; sel.onchange({target:sel});
  const cc=clipById(c.id);
  return JSON.stringify({autoP:state.lanes[LV]._autoP, curvaMovida:!!(cc.kf&&cc.kf['mot:y:mix']),
    laPistaLaSigue: state.lanes[LV]._autoP==='mot:y:mix'});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r4);

console.log('5+6) el pool de destinos tiene tope y el bloom lo comparte');
const r5 = await ev(`(()=>{ try{
  freeFxResources();
  const orig=WebGL2RenderingContext.prototype.texImage2D; let n=0;
  gl.texImage2D=function(){ n++; return orig.apply(gl,arguments); };
  try{
    _ppRT(0,1280); _ppRT(1,1280); _bloomHalfRT(0,640); _bloomHalfRT(1,640);
    _ppRT(0,2048); _ppRT(1,2048); _bloomHalfRT(0,1024); _bloomHalfRT(1,1024);
    const primera=n, entradasVivas=_fxRT.size;
    for(let k=0;k<15;k++){ _ppRT(0,1280); _ppRT(1,1280); _bloomHalfRT(0,640); _bloomHalfRT(1,640);
                           _ppRT(0,2048); _ppRT(1,2048); _bloomHalfRT(0,1024); _bloomHalfRT(1,1024); }
    const churn=n-primera;
    for(let sz=256; sz<=4096; sz+=256){ _ppRT(0,sz); _ppRT(1,sz); }   // muchos tamanyos: el pool no puede crecer sin tope
    const trasMuchos=_fxRT.size;
    return JSON.stringify({primera, entradasVivas, churnEn15Fotogramas:churn, trasMuchosTamanyos:trasMuchos,
      sinChurn:churn===0, elBloomComparte:entradasVivas===8, conTope:trasMuchos<=12});
  } finally { delete gl.texImage2D; freeFxResources(); }
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r5);

console.log('7) el selector de espectro: una foto por gesto que CAMBIA algo');
const r7 = await ev(`(async()=>{ try{
  await newProject('dome',2048,2048,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#888',LV,0,5,{x:0,y:0,scale:100});
  const c=state.clips[state.clips.length-1];
  const cv=document.createElement('canvas'); cv.width=672; cv.height=90; document.body.appendChild(cv);
  cv.getBoundingClientRect=()=>({left:0,top:0,width:672,height:90,right:672,bottom:90});
  const m={src:'audio',band:'bass',f0:0,f1:0,atk:8,rel:130};
  bindSpecPicker(cv,m,c,()=>{});
  const fotos=()=>_ustk().u.length;
  const pd=(x)=>cv.dispatchEvent(new PointerEvent('pointerdown',{clientX:x,clientY:40,bubbles:true}));
  const a0=fotos(); pd(200); window.dispatchEvent(new PointerEvent('pointerup',{clientX:200,clientY:40}));
  const clicSuelto=fotos()-a0;
  const a1=fotos(); pd(200);
  window.dispatchEvent(new PointerEvent('pointermove',{clientX:400,clientY:40}));
  window.dispatchEvent(new PointerEvent('pointermove',{clientX:420,clientY:40}));
  window.dispatchEvent(new PointerEvent('pointerup',{clientX:420,clientY:40}));
  const arrastre=fotos()-a1, hayVentana=!!(m.f0&&m.f1);
  const a2=fotos(); cv.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
  const dobleClic=fotos()-a2, borrada=(m.f0===0&&m.f1===0);
  cv.remove();
  return JSON.stringify({clicSuelto, arrastre, dobleClic, hayVentana, borrada,
    clicSueltoNoGasta:clicSuelto===0, elArrastreGuardaUna:arrastre===1, elDobleClicGuardaUna:dobleClic===1});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r7);

console.log('8) la duracion se propaga hasta el abuelo aunque el orden no ayude');
const r8 = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const A=activeSeq();
  const B=newSeqMedia('B',30,1920,1080,null,null,'flat',180);
  const C=newSeqMedia('C',30,1920,1080,null,null,'flat',180);
  const X=newSeqMedia('X',30,1920,1080,null,null,'flat',180);
  /* C ANTES que B en state.media: el orden que hacia fallar la pasada unica. */
  state.media.push(C,B,X); state.openSeqs.push(B.id,C.id,X.id);
  switchSeq(X.id,true); const LVx=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#8f8',LVx,0,9,{x:0,y:0,scale:100});
  switchSeq(B.id,true); const LVb=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoPlace(X,LVb,0,9,{});
  switchSeq(C.id,true); const LVc=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoPlace(B,LVc,0,9,{});
  switchSeq(A.id,true); const LVa=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoPlace(C,LVa,0,9,{});
  const arriba=state.clips[state.clips.length-1];
  mediaById(B.id).dur=seqDur(mediaById(B.id)); mediaById(C.id).dur=seqDur(mediaById(C.id));
  const durAntes=arriba.dur;
  deleteSequenceMedia(X.id,true);
  const cc=clipById(arriba.id), Cm=mediaById(C.id), Bm=mediaById(B.id);
  return JSON.stringify({durAntes, durArriba:cc?+cc.dur.toFixed(2):null,
    durC:+Cm.dur.toFixed(2), seqDurC:+seqDur(Cm).toFixed(2), durB:+Bm.dur.toFixed(2),
    elAbueloCuadra: !!Cm && Math.abs(Cm.dur-seqDur(Cm))<0.01,
    elClipDeArribaSeAcorta: !!cc && cc.dur<durAntes-0.5});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r8);

const malas=[];
const J=s=>{ try{ return JSON.parse(s); }catch(e){ return {err:String(s).slice(0,90)}; } };
const O=[r1,r2,r3,r4,r5,r7,r8].map(J);
O.forEach((o,i)=>{ if(o.err) malas.push('sonda '+(i+1)+' rota: '+o.err); });
const [o1,o2,o3,o4,o5,o7,o8]=O;
if(!o1.err){ if(!o1.sinDatosEsCero) malas.push('un disparo invertido sigue al 100 % sin onsets (sinOnsets='+o1.sinOnsets+', antes del primero='+o1.antesDelPrimero+')');
  if(!o1.conDatosSigueInvirtiendo) malas.push('con onsets el INV ya no invierte: regresion'); }
if(!o2.err){ if(!o2.rotaDeVerdad) malas.push('la sonda 2 no mide nada: el tejido no rota');
  if(!o2.prepNestsPideElRotado) malas.push('prepNests sigue componiendo el medio SIN rotar');
  if(!o2.coinciden) malas.push('el piloto y la rotacion no coinciden'); }
if(!o3.err&&!o3.suelta) malas.push('migrar el piso deja la cache agarrada o la bandera enganchada');
if(!o4.err){ if(!o4.curvaMovida) malas.push('la sonda 4 no mide nada: la curva no se ha movido');
  if(!o4.laPistaLaSigue) malas.push('la pista pierde la superposicion al mover la curva ('+o4.autoP+')'); }
if(!o5.err){ if(!o5.sinChurn) malas.push('sigue habiendo reasignaciones por fotograma ('+o5.churnEn15Fotogramas+')');
  if(!o5.elBloomComparte) malas.push('el bloom no comparte el pool ('+o5.entradasVivas+' entradas)');
  if(!o5.conTope) malas.push('el pool crece sin tope ('+o5.trasMuchosTamanyos+' entradas)'); }
if(!o7.err){ if(!o7.hayVentana) malas.push('la sonda 7 no mide nada: el arrastre no puso ventana');
  if(!o7.clicSueltoNoGasta) malas.push('un clic suelto sigue gastando historial ('+o7.clicSuelto+')');
  if(!o7.elArrastreGuardaUna) malas.push('el arrastre no guarda exactamente una foto ('+o7.arrastre+')');
  if(!o7.elDobleClicGuardaUna) malas.push('el doble clic no guarda foto ('+o7.dobleClic+')'); }
if(!o8.err){ if(!o8.elClipDeArribaSeAcorta) malas.push('la sonda 8 no mide nada: el clip de arriba no se acorta');
  if(!o8.elAbueloCuadra) malas.push('el abuelo conserva la duracion vieja ('+o8.durC+' con contenido de '+o8.seqDurC+')'); }
console.log('');
for(const m of malas) console.log('   *** '+m);
console.log(malas.length ? ('*** '+malas.length+' FALLOS') : 'las diez de la segunda revision, medidas');
ws.close(); process.exit(malas.length?1:0);
