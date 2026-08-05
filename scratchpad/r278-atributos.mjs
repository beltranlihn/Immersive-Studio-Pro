/* [R278] Copiar/pegar atributos. Lo que hay que demostrar, con las palabras de Beltran:
     - viajan transform, bucle, efectos, motion y automatizaciones;
     - NO viaja la configuracion del compose;
     - NUNCA cambian duracion ni posicion del destino;
     - de un clip de 40 s a uno de 15 s solo llega la automatizacion que cabe en esos 15. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||r.result.exceptionDetails.text)):res(r.result.result.value)));
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };

await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`);
await wait(1600);

const r=await ev(`(function(){
  const m1={id:uid(),name:'largo.mp4',kind:'video',w:1920,h:1080,dur:60,fps:30,color:'#8a8',path:'a',folder:null};
  const m2={id:uid(),name:'corto.mp4',kind:'video',w:1920,h:1080,dur:20,fps:30,color:'#88a',path:'b',folder:null};
  state.media.push(m1,m2); renderMedia();
  const ln=state.lanes[0].id;
  addClip(m1,ln,0,{inP:0,dur:40}); const A=state.clips[state.clips.length-1];
  addClip(m2,ln,50,{inP:0,dur:15}); const B=state.clips[state.clips.length-1];
  A.dur=40; B.dur=15; B.start=50;

  /* ORIGEN: transform, bucle, efectos y automatizacion que se sale de 15 s */
  A.props.az=42; A.props.el=-12; A.props.size=88; A.props.opacity=64; A.props.blur=7; A.props.saturation=30;
  A.loop=true; A.loopLen=35; A.speed=1.25;
  A.fx=[{id:1,type:'pulsescale',int:70,amt:40,on:true}];
  A.kf={ opacity:[{t:0,v:0},{t:10,v:100},{t:30,v:20},{t:38,v:100}],
         az:[{t:20,v:0},{t:35,v:180}] };          /* ninguna cae dentro de 15 salvo por el arranque interpolado */
  A.comp={kind:'tunnel',count:9};                 /* configuracion de composicion: NO debe viajar */

  /* DESTINO: valores propios y su propia composicion */
  B.props.az=0; B.props.opacity=100; B.comp={kind:'weave',count:4};
  const antes={start:B.start,dur:B.dur,lane:B.lane,mediaId:B.mediaId,comp:JSON.stringify(B.comp)};

  state.selId=A.id; state.selIds=[A.id]; copyAttrs();
  state.selId=B.id; state.selIds=[B.id]; pasteAttrs();

  return { antes,
    despues:{start:B.start,dur:B.dur,lane:B.lane,mediaId:B.mediaId,comp:JSON.stringify(B.comp)},
    az:B.props.az, el:B.props.el, size:B.props.size, opacity:B.props.opacity, sat:B.props.saturation,
    loop:B.loop, loopLen:B.loopLen, speed:B.speed,
    fx:(B.fx||[]).map(f=>f.type+':'+f.int).join(','),
    kfOpacity:(B.kf&&B.kf.opacity||[]).map(k=>k.t+'@'+Math.round(k.v)).join(' '),
    kfAz:(B.kf&&B.kf.az||[]).map(k=>k.t+'@'+Math.round(k.v)).join(' ') || '(ninguna)',
    kfOrigenIntacta:(A.kf.opacity||[]).length }; })()`);

console.log('destino antes:  '+JSON.stringify(r.antes));
console.log('destino despues:'+JSON.stringify(r.despues));
console.log('transform: az='+r.az+' el='+r.el+' size='+r.size+'   opacity='+r.opacity+' sat='+r.sat);
console.log('bucle: loop='+r.loop+' loopLen='+r.loopLen+' (el archivo destino dura 20)   speed='+r.speed);
console.log('efectos: '+r.fx);
console.log('automatizacion opacity: '+r.kfOpacity);
console.log('automatizacion az:      '+r.kfAz);

if(r.antes.start!==r.despues.start||r.antes.dur!==r.despues.dur) mal('ha cambiado sitio o duracion del destino');
if(r.antes.lane!==r.despues.lane||r.antes.mediaId!==r.despues.mediaId) mal('ha cambiado la pista o el medio del destino');
if(r.antes.comp!==r.despues.comp) mal('la configuracion de composicion ha viajado, y no debia');
if(r.az!==42||r.el!==-12||r.size!==88||r.opacity!==64||r.sat!==30) mal('el transform/color no ha llegado entero');
if(r.loop!==true) mal('el bucle no ha viajado');
if(r.loopLen>20) mal('loopLen='+r.loopLen+' se sale del archivo destino (20 s): habia que acotarlo');
if(r.speed!==1.25) mal('la velocidad no ha viajado');
if(r.fx!=='pulsescale:70') mal('los efectos no han llegado: "'+r.fx+'"');
/* opacity: puntos 0,10 caben en 15; 30 y 38 no */
if(r.kfOpacity!=='0@0 10@100') mal('la automatizacion no se ha recortado a los 15 s: "'+r.kfOpacity+'"');
/* az: sus dos puntos (20 y 35) caen fuera -> el clip se queda sin esa curva */
if(r.kfAz!=='(ninguna)') mal('az tenia sus dos puntos fuera de los 15 s y aun asi ha llegado: "'+r.kfAz+'"');
if(r.kfOrigenIntacta!==4) mal('se ha tocado el clip ORIGEN al copiar');
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'los atributos viajan, el compose no, y la automatizacion se recorta a la duracion'));
ws.close();
