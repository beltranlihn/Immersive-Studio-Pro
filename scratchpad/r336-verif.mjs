/* [R336] Las correcciones de la revision de R328-R335 — cuatro de ellas regresiones propias.
   Cada comprobacion esta escrita para FALLAR si se revierte su arreglo; las que podrian pasar por casualidad
   llevan control.

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r336-verif.mjs
*/
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const p=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise(r=>{const i=++id;p.set(i,m=>r(m.result&&m.result.exceptionDetails?('EXC '+(m.result.exceptionDetails.exception?.description||'').slice(0,80)):(m.result&&m.result.result&&m.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true,timeout:60000}}));});

console.log('');
console.log('R336 - las correcciones de la revision');
console.log('');

console.log('1) borrar el clip fuente suelta la cache reactiva DE VERDAD (con srcClipId puesto)');
const r1 = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#888',LV,0,4,{x:0,y:0,scale:100});
  const c=state.clips[state.clips.length-1];
  /* La clave que faltaba en la red de R332: apuntar srcClipId AL CLIP. Sin esto, reactiveSourceClip() devolvia
     null por otro motivo y la sonda pasaba aunque el arreglo fuera inerte. */
  ensureReactive().srcClipId=c.id;
  _arCache={clip:c, fps:30, raw:{bass:new Float32Array(8)}, bass:new Float32Array(8),
            mid:new Float32Array(8), treble:new Float32Array(8), bright:new Float32Array(8), beats:[], bpm:0, beat0:0};
  const apuntaAlClip=_arCache.clip.id===c.id, loEncuentra=!!reactiveSourceClip();
  _quitarClips([c.id]);
  const sigue=!!(_arCache&&_arCache.clip&&_arCache.clip.id===c.id);
  return JSON.stringify({apuntaAlClip, loEncuentra, sigueAgarrada:sigue, suelta:apuntaAlClip&&loEncuentra&&!sigue});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r1);

console.log('2) cambiar de fuente cancela el callback de video en vez de tirar su manejador');
const r2 = await ev(`(()=>{ try{
  const A={id:960001,kind:'video',name:'A',path:'C:/no/A.mp4',srcUrl:'file:///C:/no/A.mp4',dur:60,w:1920,h:1080,fps:30};
  const B={id:960002,kind:'video',name:'B',path:'C:/no/B.mp4',srcUrl:'file:///C:/no/B.mp4',dur:60,w:1920,h:1080,fps:30};
  state.media.push(A,B);
  const c={id:960101,lane:0,mediaId:A.id,start:0,dur:5,inP:0,speed:1,props:{}};
  let cancelados=0, pausas=0;
  const vi={vel:{muted:true,playsInline:true,preload:'auto',paused:false,pause:()=>{pausas++;},
                 cancelVideoFrameCallback:(h)=>{ cancelados++; }},
            vtex:newTex(), vsrc:'file:///C:/no/A.mp4', ready:true, vf:1234, last:0, loadP:null, cd:null,
            cdPending:false, cdReadyP:null, mid:A.id};
  _vinst.set(c.id,vi);
  vinstEnsure(c,B);
  return JSON.stringify({cancelados, pausas, midNuevo:vi.mid===B.id, vfLimpio:vi.vf===0,
    /* el segundo pause lo hace el re-enlace normal del elemento (bindVideoSrc), que es correcto: lo que se
       mide aqui es que el callback se CANCELA una vez en vez de tirarse el manejador. */
    cancelaYPara: cancelados===1 && pausas>=1});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r2);

console.log('3) un efecto de DISPARO invertido no se dispara donde no hay senal');
const r3 = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#888',LV,0,4,{x:0,y:0,scale:100});
  const c=state.clips[state.clips.length-1];
  const fx={id:1,type:'glow',on:true,band:'bass',mode:'trigger',int:0,amt:100,atk:8,rel:130,curve:50,spring:0,inv:true};
  _arCache=null; _arTime=1; const sinCache=fxModLevel(fx);
  _arCache={clip:c, fps:90, onsets:{bass:[0.5]}, beats:[0.5], bpm:0, beat0:0,
            raw:{bass:new Float32Array(360)}, bass:new Float32Array(360), mid:new Float32Array(360),
            treble:new Float32Array(360), bright:new Float32Array(360)};
  _arTime=9;   const fuera=fxModLevel(fx);          // fuera del clip fuente: no hay informacion
  /* JUSTO en el onset la envolvente vale 0 y sube durante el ataque (8 ms): el punto alto esta un pelo
     despues, no encima. Medir en 0.5 daba 1 en los dos lados y no discriminaba nada. */
  _arTime=0.51; const enElGolpe=fxModLevel(fx);     // pasado el ataque -> disparo alto -> invertido ~0
  _arTime=3.5; const lejosDelGolpe=fxModLevel(fx);  // dentro del clip, 3 s despues -> caido -> invertido ~1
  _arCache=null;
  return JSON.stringify({sinCache:+sinCache.toFixed(3), fuera:+fuera.toFixed(3),
    enElGolpe:+enElGolpe.toFixed(3), lejosDelGolpe:+lejosDelGolpe.toFixed(3),
    sinSenalEsCero: sinCache===0 && fuera===0,
    dentroSigueInvirtiendo: enElGolpe<0.2 && lejosDelGolpe>0.8});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r3);

console.log('4) una ventana guardada por encima de Nyquist cae a la banda con nombre');
const r4 = await ev(`(()=>{ try{
  const vieja=modVentana({f0:9000,f1:12000});     // proyecto anterior a R335: fuera del rango del analisis
  const bordeAdentro=modVentana({f0:5000,f1:12000}); // se recorta a 5000-8000, sigue siendo ventana
  const normal=modVentana({f0:200,f1:2000});
  const et=modLabel({src:'audio',f0:9000,f1:12000});
  return JSON.stringify({vieja, bordeAdentro, normal, etiqueta:et,
    laViejaCae: vieja===null,
    elBordeSeRecorta: !!(bordeAdentro&&bordeAdentro.lo===5000&&bordeAdentro.hi===SPEC_F1),
    laNormalIntacta: !!(normal&&normal.lo===200&&normal.hi===2000),
    laEtiquetaNoMiente: !/9000/.test(et)});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r4);

console.log('5) el adelanto invalida compTex al pisarlo con otro instante');
const r5 = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#FF0000',LV,0,1,{x:0,y:0,scale:100});
  _demoAddShape('rect','#00FF00',LV,1,1,{x:0,y:0,scale:100});
  _raOn=true; try{raInvalidate();}catch(e){}
  state.playhead=0.5; render();
  const teniaAlgo=!!_lastSrcTex;
  await raPrerenderRange(1.4,1.5,null);
  const trasElAdelanto=_lastSrcTex;
  _raOn=false;
  return JSON.stringify({teniaAlgo, invalidada:trasElAdelanto===null});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r5);

console.log('6) el bufer NV12 cuadra con lo que lee FFmpeg, tambien con altura impar');
const r6 = await ev(`(()=>{ try{
  const mide=(W,H)=>{ const N=nv12Prep(W,H); return N?N.buf.length:null; };
  const espera=(W,H)=>W*H+W*Math.ceil(H/2);
  const par=mide(1920,1080), parE=espera(1920,1080);
  const impar=mide(1920,1081), imparE=espera(1920,1081);
  const raro=mide(1918,1080), raroE=espera(1918,1080);
  return JSON.stringify({par, parE, impar, imparE, raro, raroE,
    cuadraPar:par===parE, cuadraImpar:impar===imparE, cuadraAncho:raro===raroE});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r6);

console.log('7) lo seleccionable es lo que se pinta: orden por tamano y sin transparentes');
const r7 = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  while(state.lanes.filter(l=>l.kind!=='audio').length<2) state.lanes.unshift({name:'V+',kind:'video',h:56});
  const lv=state.lanes.map((l,i)=>[l,i]).filter(x=>x[0].kind!=='audio').map(x=>x[1]);
  _demoAddShape('rect','#888',lv[0],0,5,{x:0,y:0,scale:100}); const grande=state.clips[state.clips.length-1];
  _demoAddShape('rect','#999',lv[1],0,5,{x:0,y:0,scale:100}); const pequeno=state.clips[state.clips.length-1];
  grande.props.size=90; pequeno.props.size=20; state.playhead=1;
  const sinOrden=clipsVisibles(1).map(c=>c.id);
  _zsortSize=true; const conOrden=clipsVisibles(1).map(c=>c.id); _zsortSize=false;
  return JSON.stringify({sinOrden, conOrden, grande:grande.id, pequeno:pequeno.id,
    ordenDePista: sinOrden[sinOrden.length-1]===pequeno.id,
    ordenPorTamano: conOrden[conOrden.length-1]===grande.id});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r7);

console.log('8) el buscador del domo usa el valor MODULADO');
const r8 = await ev(`(async()=>{ try{
  await newProject('dome',2048,2048,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#888',LV,0,4,{x:0,y:0,scale:100});
  const c=state.clips[state.clips.length-1];
  c.props.az=0; c.props.el=45; c.props.size=30; state.playhead=1;
  c.mod={az:[{id:1,src:'lfo',blend:'add',depth:100,on:true,shape:'sine',rate:0.5,phase:0,frz:1}]};
  const base=evalP(c,'az',1), modulado=evalR(c,'az',1);
  const enBase=pickClip(azel2f(base,45))?pickClip(azel2f(base,45)).id:null;
  const enModulado=pickClip(azel2f(modulado,45))?pickClip(azel2f(modulado,45)).id:null;
  return JSON.stringify({base, modulado, difieren:Math.abs(modulado-base)>2,
    enBase, enModulado, loEncuentraDondeSeVe:enModulado===c.id, yaNoEnLaBase:enBase!==c.id});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r8);

console.log('9) borrar una secuencia acorta tambien el clip del abuelo');
const r9 = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const A=activeSeq();
  const B=newSeqMedia('B',30,1920,1080,null,null,'flat',180);
  const C=newSeqMedia('C',30,1920,1080,null,null,'flat',180);
  state.media.push(B,C); state.openSeqs.push(B.id,C.id);
  switchSeq(C.id,true);
  const LVc=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#8f8',LVc,0,6,{x:0,y:0,scale:100});
  switchSeq(B.id,true);
  const LVb=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoPlace(C,LVb,0,6,{});
  switchSeq(A.id,true);
  const LVa=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoPlace(B,LVa,0,6,{});
  const abuelo=state.clips[state.clips.length-1];
  const durAntes=abuelo.dur;
  deleteSequenceMedia(C.id,true);
  const ab=clipById(abuelo.id);
  return JSON.stringify({durAntes, durDespues:ab?+ab.dur.toFixed(2):null, durDeB:+mediaById(B.id).dur.toFixed(2),
    seAcorta: !!ab && ab.dur<durAntes-0.5});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r9);

const malas=[];
const J=s=>{ try{ return JSON.parse(s); }catch(e){ return {err:String(s).slice(0,90)}; } };
const O=[r1,r2,r3,r4,r5,r6,r7,r8,r9].map(J);
O.forEach((o,i)=>{ if(o.err) malas.push('sonda '+(i+1)+' rota: '+o.err); });
const [o1,o2,o3,o4,o5,o6,o7,o8,o9]=O;
if(!o1.err){ if(!o1.loEncuentra) malas.push('la sonda 1 no mide nada: reactiveSourceClip no encuentra el clip');
  if(!o1.suelta) malas.push('la cache reactiva sigue agarrada al clip borrado: el arreglo sigue inerte'); }
if(!o2.err&&!o2.cancelaYPara) malas.push('cambiar de fuente no cancela el callback de video ('+o2.cancelados+') ni para el elemento ('+o2.pausas+')');
if(!o3.err){ if(!o3.sinSenalEsCero) malas.push('un disparo invertido sigue al 100 % sin senal (sinCache='+o3.sinCache+', fuera='+o3.fuera+')');
  if(!o3.dentroSigueInvirtiendo) malas.push('dentro del clip el disparo con INV ya no invierte: regresion'); }
if(!o4.err){ if(!o4.laViejaCae) malas.push('una ventana guardada por encima de Nyquist sigue viva y da ceros');
  if(!o4.elBordeSeRecorta) malas.push('una ventana a caballo del techo no se recorta');
  if(!o4.laNormalIntacta) malas.push('una ventana normal ha cambiado: regresion');
  if(!o4.laEtiquetaNoMiente) malas.push('la etiqueta sigue anunciando una ventana que no produce senal'); }
if(!o5.err){ if(!o5.teniaAlgo) malas.push('la sonda 5 no mide nada: no habia textura reutilizable');
  if(!o5.invalidada) malas.push('el adelanto pisa compTex sin invalidar la reutilizacion'); }
if(!o6.err){ if(!o6.cuadraPar) malas.push('el bufer NV12 ya no cuadra con altura par: regresion');
  if(!o6.cuadraImpar) malas.push('el bufer NV12 sigue una fila corto con altura impar ('+o6.impar+' en vez de '+o6.imparE+')');
  if(!o6.cuadraAncho) malas.push('el bufer NV12 no cuadra con ancho no alineado'); }
if(!o7.err){ if(!o7.ordenDePista) malas.push('la sonda 7 no mide nada: sin tunel el orden ya no es el de pista');
  if(!o7.ordenPorTamano) malas.push('los buscadores no siguen el orden por tamano del tunel'); }
if(!o8.err){ if(!o8.difieren) malas.push('la sonda 8 no mide nada: la modulacion no mueve el azimut');
  if(!o8.loEncuentraDondeSeVe) malas.push('el buscador del domo no encuentra el clip donde se ve');
  if(!o8.yaNoEnLaBase) malas.push('el buscador sigue encontrandolo en su posicion base'); }
if(!o9.err&&!o9.seAcorta) malas.push('el clip del abuelo sigue estirado ('+o9.durDespues+' sobre contenido de '+o9.durDeB+')');
console.log('');
for(const m of malas) console.log('   *** '+m);
console.log(malas.length ? ('*** '+malas.length+' FALLOS') : 'las correcciones de la revision, medidas');
ws.close(); process.exit(malas.length?1:0);
