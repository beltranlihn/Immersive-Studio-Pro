/* [R242c] La regla de Beltrán para el encuadre de secuencia, con SU escenario:
   «Si la secuencia A la dejé en el minuto 70 y la B en el 5: si entro a la A debo estar en el 70 y si entro a la
    B en el 5. Siempre manda la última vez que entramos. Y si es la primera vez, 00.»
   Se comprueba que el comportamiento vigente (R239) ES exactamente ese, en segundos de línea de tiempo. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out={};
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e))); return 1; })()`);
await ev(`(async()=>{ state.dirty=false; await newProject('flat',1920,1080,60,180,true); })()`); await wait(700);

/* dos secuencias A y B, más la de fábrica; el zoom fijo para que segundos↔píxeles sea comparable */
out.montaje=await ev(`(function(){ state.tl.pxPerSec=20; renderTimeline();
  const A=newSeqMedia('A',60,1920,1080,null,null,'flat'); const B=newSeqMedia('B',60,1920,1080,null,null,'flat');
  state.media.push(A,B); state.openSeqs.push(A.id,B.id); renderSeqBar();
  return { A:A.id, B:B.id, pps:state.tl.pxPerSec }; })()`);
const {A,B}=out.montaje;
const seg=()=>ev(`(function(){ const sc=document.querySelector('#tlscroll'); return +( (sc.scrollLeft||0)/state.tl.pxPerSec ).toFixed(2); })()`);
const ir=id=>ev(`(function(){ switchSeq(${id}); return 1; })()`);
const dejarEn=s=>ev(`(function(){ const sc=document.querySelector('#tlscroll'), px=${s}*state.tl.pxPerSec;
  state.tl._scrollTarget=px; renderTimeline(); sc.scrollLeft=px; state.tl._scrollTarget=0; return 1; })()`);

/* 1 · PRIMERA vez en A y en B → 0 en las dos */
await ir(A); out['1_primeraVezA']=await seg();
await ir(B); out['1_primeraVezB']=await seg();

/* 2 · dejar A en el minuto 70 (4200 s) y B en el 5 (300 s) */
await ir(A); await dejarEn(4200); out['2_dejoAen']=await seg();
await ir(B); await dejarEn(300);  out['2_dejoBen']=await seg();

/* 3 · volver a cada una: manda la última vez */
await ir(A); out['3_vuelvoA']=await seg();
await ir(B); out['3_vuelvoB']=await seg();
/* y otra vuelta, para descartar que sólo aguante un salto */
await ir(A); out['3_vuelvoA_bis']=await seg();
await ir(B); out['3_vuelvoB_bis']=await seg();

/* 4 · una secuencia CREADA AHORA, estando en el minuto 70, abre en 0 */
await ir(A);
out['4_nuevaDesdeElMinuto70']=await ev(`(async function(){
  const antes=+((document.querySelector('#tlscroll').scrollLeft||0)/state.tl.pxPerSec).toFixed(2);
  const C=newSeqMedia('C',60,1920,1080,null,null,'flat'); state.media.push(C); state.openSeqs.push(C.id);
  saveActiveSeq(); state.activeSeqId=C.id; loadSeqIntoState(C);
  renderSeqBar(); renderTimeline(); setTlScrollT(0);
  return { estabaEn:antes, abreEn:+((document.querySelector('#tlscroll').scrollLeft||0)/state.tl.pxPerSec).toFixed(2) }; })()`);

out.veredicto={
  primeraVezSiempreCero: (out['1_primeraVezA']===0 && out['1_primeraVezB']===0 && out['4_nuevaDesdeElMinuto70'].abreEn===0),
  mandaLaUltimaVez: (out['3_vuelvoA']===4200 && out['3_vuelvoB']===300 && out['3_vuelvoA_bis']===4200 && out['3_vuelvoB_bis']===300)
};
await ev(`(async()=>{ state.dirty=false; await newProject('dome',4096,4096,60,180,true); })()`);
out.errs=await ev(`window.__errs.slice(0,10)`);
console.log(JSON.stringify(out,null,1));
ws.close();
