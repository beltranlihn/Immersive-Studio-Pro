/* [R269] Punto 1: Elevation admite negativos. Se comprueba en el DOM (el fader y el numero) y en el motor
   (que un valor negativo se dibuje de verdad, no que se recorte a 0). */
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
await wait(1400);
const r=await ev(`(function(){
  state.media.push({id:uid(),name:'f.mp4',kind:'video',w:1920,h:1080,dur:10,fps:30,color:'#888',path:'x',folder:null});
  const m=state.media[state.media.length-1];
  state.clips=[]; const c=makeClip(m,state.lanes.findIndex(l=>l.kind==='video'),0); c.dur=5; state.clips.push(c);
  state.selId=c.id; state.selIds=[c.id]; renderInspector();
  const fila=[...document.querySelectorAll('#tfRows .prow')].find(r=>{ const f=r.querySelector('.field'); return f&&f.dataset.p==='el'; });
  const def=TF.find(d=>d[0]==='el');
  /* y que el motor lo acepte: se escribe -45 y se lee lo que ve el render */
  manualEdit(c,'el',-45);
  manualEdit(c,'el',-45); renderInspector();
  const f2=[...document.querySelectorAll('#tfRows .field')].find(f=>f.dataset.p==='el');
  return { topes:{min:def[3],max:def[4]}, hayFila:!!f2, muestra:f2?f2.querySelector('.num').textContent:null,
           guardado:c.props.el, queVeElRender:evalR(c,'el',0) }; })()`);
console.log('topes de la fila: '+JSON.stringify(r.topes)+'   fila en el inspector: '+r.hayFila+'   muestra: '+r.muestra);
console.log('tras escribir -45 -> guardado: '+r.guardado+'   lo que ve el render: '+r.queVeElRender);
if(!r.topes||r.topes.min!==-90) mal('la fila no llega a -90');
if(!r.hayFila) mal('no aparece la fila de elevacion');
if(String(r.muestra).indexOf('-45')<0) mal('el inspector no muestra -45 (muestra '+r.muestra+')');
if(r.guardado!==-45) mal('no se guarda el valor negativo');
if(r.queVeElRender!==-45) mal('el render no recibe el valor negativo');
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'elevacion negativa, correcta'));
ws.close();
