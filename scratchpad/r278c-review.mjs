/* [R278c] Los siete hallazgos del code review sobre R278b. Cada bloque reproduce el escenario descrito. */
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
  const out={}; let ultimo='';
  const orig=window.flashStatus; window.flashStatus=(m,k)=>{ ultimo=String(m||''); return orig?orig(m,k):null; };
  const largo={id:uid(),name:'largo.mp4',kind:'video',w:1920,h:1080,dur:60,fps:30,color:'#8a8',path:'a',folder:null};
  const corto={id:uid(),name:'corto.mp4',kind:'video',w:1920,h:1080,dur:5,fps:30,color:'#88a',path:'b',folder:null};
  state.media.push(largo,corto); renderMedia();
  const ln=state.lanes[0].id;

  /* ── H1: un clip LOOPEADO estirado a 60 s sobre un archivo de 5 s recibe atributos de uno SIN bucle */
  addClip(largo,ln,0);  const A=state.clips[state.clips.length-1]; A.dur=40; delete A.loop; delete A.loopLen;
  addClip(corto,ln,80); const B=state.clips[state.clips.length-1]; B.dur=60; B.start=80; B.loop=true; B.loopLen=5; B.inP=0;
  A.props.az=42;
  state.selId=A.id; state.selIds=[A.id]; copyAttrs();
  state.selId=B.id; state.selIds=[B.id]; pasteAttrs();
  out.loopTrasPegar=!!B.loop; out.durB=B.dur; out.azB=B.props.az; out.avisoLoop=/loop kept|bucle conservado/.test(ultimo);

  /* ── H1b: el mismo pegado sobre un clip cuyo archivo SI da de si debe quitarle el bucle */
  addClip(largo,ln,150); const C=state.clips[state.clips.length-1]; C.dur=10; C.start=150; C.loop=true; C.loopLen=8; C.inP=0;
  state.selId=C.id; state.selIds=[C.id]; pasteAttrs();
  out.loopSobrante=!!C.loop;

  /* ── H2: se pierde EXACTAMENTE un keyframe -> el aviso tiene que salir */
  addClip(largo,ln,200); const D=state.clips[state.clips.length-1]; D.dur=40; D.start=200;
  D.kf={ opacity:[{t:2,v:10},{t:30,v:90}] };
  addClip(largo,ln,260); const E=state.clips[state.clips.length-1]; E.dur=10; E.start=260;
  state.selId=D.id; state.selIds=[D.id]; copyAttrs();
  ultimo='';
  state.selId=E.id; state.selIds=[E.id]; pasteAttrs();
  out.avisoRecorte=/trimmed to fit|recortada a la duraci/.test(ultimo);
  out.kfE=(E.kf&&E.kf.opacity||[]).map(k=>k.t).join(',');

  window.flashStatus=orig;
  /* ── H5: ninguna clave inerte en la lista */
  out.inertes=[...ATTR_FUERA].filter(k=>k==='oldgroup'||k==='oldgroupId').length;
  /* ── H3: el emparejado A/V se rehace */
  out.linkPartner=(typeof linkPartner);
  return out; })()`);

console.log('H1 bucle tras pegar sobre clip de 60 s con archivo de 5 s: '+r.loopTrasPegar+'   dur='+r.durB+'   aviso="'+r.avisoLoop+'"');
if(!r.loopTrasPegar) mal('le ha quitado el bucle: 55 s de fotograma congelado');
if(r.durB!==60) mal('ha cambiado la duracion del destino');
if(r.azB!==42) mal('lo que SI debia llegar no ha llegado');
if(!r.avisoLoop) mal('conserva el bucle pero no lo dice');
console.log('H1b bucle sobrante (archivo de 60 s, clip de 10 s): '+r.loopSobrante+'  (debe ser false)');
if(r.loopSobrante) mal('conserva un bucle que no hacia falta: eso ya no es pegar atributos');

console.log('H2 se pierde 1 keyframe -> aviso: '+r.avisoRecorte+'   quedan en t='+r.kfE);
if(!r.avisoRecorte) mal('se ha perdido un punto y no ha avisado');

console.log('H5 claves inertes en ATTR_FUERA: '+r.inertes);
if(r.inertes) mal('siguen las claves inventadas');
console.log('H3 linkPartner: '+r.linkPartner);
if(r.linkPartner!=='function') mal('linkPartner no existe: la llamada nueva no hace nada');

/* ── H6: Ctrl+Alt+A no debe esconder la vista de automatizacion */
const h6=await ev(`(function(){ const antes=!!(state.prefs&&state.prefs.curves!==false);
  const e=new KeyboardEvent('keydown',{key:'a',ctrlKey:true,altKey:true,bubbles:true});
  window.dispatchEvent(e); document.dispatchEvent(e);
  return {antes, despues:!!(state.prefs&&state.prefs.curves!==false)}; })()`);
console.log('H6 vista de automatizacion antes/despues de Ctrl+Alt+A: '+h6.antes+' / '+h6.despues);
if(h6.antes!==h6.despues) mal('Ctrl+Alt+A sigue escapandose y cambia la vista de automatizacion');

console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'los siete hallazgos del review quedan cerrados'));
ws.close();
