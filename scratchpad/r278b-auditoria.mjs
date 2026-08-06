/* [R278b] Verificacion de los arreglos de la auditoria de Fable. Cada bloque reproduce el ESCENARIO del
   hallazgo, no una version comoda de el. */
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
  const out={};
  const m1={id:uid(),name:'a.mp4',kind:'video',w:1920,h:1080,dur:60,fps:30,color:'#8a8',path:'a',folder:null};
  const m2={id:uid(),name:'b.mp4',kind:'video',w:1920,h:1080,dur:20,fps:30,color:'#88a',path:'b',folder:null};
  state.media.push(m1,m2); renderMedia();
  const ln=state.lanes[0].id;
  addClip(m1,ln,0); const A=state.clips[state.clips.length-1]; A.dur=40;
  addClip(m2,ln,50); const B=state.clips[state.clips.length-1]; B.dur=15; B.start=50;

  /* ── H1: el campo slot. El origen es miembro 7 de una composicion; el destino, miembro 1 de otra. */
  A.groupId=101; A.slot=7;
  B.groupId=202; B.slot=1;
  /* ── H3: el destino tiene cosas OPCIONALES que el origen no tiene */
  B.penMasks=[{pts:[[0,0],[1,0],[1,1]],feather:3,invert:false,on:true}]; B.loop=true; B.loopLen=9; B.speed=0.5;
  A.props.az=42; A.props.opacity=64;
  A.kf={ opacity:[{t:0,v:0},{t:10,v:100},{t:30,v:20}] };

  state.selId=A.id; state.selIds=[A.id]; copyAttrs();
  state.selId=B.id; state.selIds=[B.id]; pasteAttrs();

  out.slot=B.slot; out.groupId=B.groupId;
  out.sobras={penMasks:!!(B.penMasks&&B.penMasks.length), loop:!!B.loop, speed:B.speed!=null?B.speed:'(sin)'};
  out.az=B.props.az; out.dur=B.dur; out.start=B.start;
  out.autoSel=state.autoSel; out.shapeBox=state.shapeBox;

  /* ── H2: ya no puede haber dos pares de copiar/pegar atributos */
  out.viejoCopy=(typeof copyAttributes); out.viejoPaste=(typeof pasteAttributes);

  /* ── H8: relleno desde el CERO en un mando bipolar */
  const bip=document.createElement('input'); bip.type='range'; bip.min='-90'; bip.max='90'; bip.value='-45';
  document.body.appendChild(bip); faderFill(bip);
  out.bipolar={pa:bip.style.getPropertyValue('--pa'), pb:bip.style.getPropertyValue('--pb')};
  bip.value='0'; faderFill(bip);
  out.bipolarCero={pa:bip.style.getPropertyValue('--pa'), pb:bip.style.getPropertyValue('--pb')};
  const uni=document.createElement('input'); uni.type='range'; uni.min='0'; uni.max='100'; uni.value='30';
  document.body.appendChild(uni); faderFill(uni);
  out.unipolar={pa:uni.style.getPropertyValue('--pa'), pb:uni.style.getPropertyValue('--pb')};
  bip.remove(); uni.remove();

  return out; })()`);

console.log('H1 slot del destino: '+r.slot+' (era 1, el origen traia 7)   groupId: '+r.groupId);
if(r.slot!==1) mal('el slot del origen ha viajado: el re-layout podria borrar el clip');
if(r.groupId!==202) mal('el groupId del destino ha cambiado');

console.log('H3 sobras del destino tras pegar de un clip limpio: '+JSON.stringify(r.sobras));
if(r.sobras.penMasks) mal('la mascara de pluma del destino ha sobrevivido a un pegado que no la traia');
if(r.sobras.loop) mal('el bucle del destino ha sobrevivido');
if(r.sobras.speed!=='(sin)') mal('la velocidad del destino ha sobrevivido: '+r.sobras.speed);
if(r.az!==42) mal('lo que SI debia llegar no ha llegado (az='+r.az+')');
if(r.dur!==15||r.start!==50) mal('ha cambiado sitio o duracion');

console.log('H2 par viejo: copyAttributes='+r.viejoCopy+'  pasteAttributes='+r.viejoPaste);
if(r.viejoCopy!=='undefined'||r.viejoPaste!=='undefined') mal('el par viejo sigue existiendo: dos semanticas bajo el mismo rotulo');

console.log('H8 bipolar -90..90 en -45: relleno de '+r.bipolar.pa+' a '+r.bipolar.pb+'   en 0: '+r.bipolarCero.pa+' a '+r.bipolarCero.pb);
console.log('   unipolar 0..100 en 30: de '+r.unipolar.pa+' a '+r.unipolar.pb);
if(r.bipolar.pa!=='25.0%'||r.bipolar.pb!=='50.0%') mal('el bipolar no rellena del cero al valor');
if(r.bipolarCero.pa!==r.bipolarCero.pb) mal('en cero el bipolar deberia no rellenar nada');
if(r.unipolar.pa!=='0.0%'||r.unipolar.pb!=='30.0%') mal('el unipolar ha cambiado de comportamiento');

console.log('H_autoSel tras reemplazar kf: autoSel='+r.autoSel+'  shapeBox='+r.shapeBox);
if(r.autoSel||r.shapeBox) mal('quedan referencias vivas a keyframes que ya no existen');

console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'los hallazgos de la auditoria quedan cerrados'));
ws.close();
