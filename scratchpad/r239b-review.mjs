/* [R239b] Los cinco hallazgos de la revisión del diff de R239. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:120000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out={};
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e)));
 if(!window.__errHook){ window.__errHook=1; const ce=console.error; console.error=function(){try{__errs.push('con: '+[...arguments].map(String).join(' '));}catch(_){}return ce.apply(console,arguments);}; }
 return 1; })()`);
await ev(`state.dirty=false;1`);
await ev(`(async()=>{try{await startDemoProject('dome');}catch(e){window.__d=String(e);}})()`); await wait(2600);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){} return 1;})()`); await wait(600);

/* F1 · secuencia NUEVA desde un encuadre lejano → al origen (no al minuto 55) */
out.F1_seqNueva=await ev(`(function(){ const sc=document.getElementById('tlscroll');
  sc.scrollLeft=600*state.tl.pxPerSec; renderTimeline();
  const antes=+(sc.scrollLeft/state.tl.pxPerSec).toFixed(1);
  /* mismo camino que el diálogo: crear + activar + repintar + encuadrar */
  saveActiveSeq(); const m=newSeqMedia('Nueva',60,2048,2048,null,null,'dome',180); state.media.push(m);
  state.openSeqs.push(m.id); state.activeSeqId=m.id; loadSeqIntoState(m);
  renderMedia(); renderSeqBar(); renderTimeline(); renderInspector(); render(); setTlScrollT(0);
  const dsp=+(sc.scrollLeft/state.tl.pxPerSec).toFixed(1);
  return { antes, despues:dsp, alOrigen:dsp<0.05 }; })()`);

/* F2 · eliminar la secuencia ACTIVA aterriza en otra con SU encuadre */
out.F2_borrar=await ev(`(function(){ const sc=document.getElementById('tlscroll');
  const seqs=state.media.filter(isSeqMedia); const otra=seqs.find(s=>s.id!==state.activeSeqId);
  if(!otra)return {salta:'una sola secuencia'};
  otra.nestScrollT=42; const borrada=state.activeSeqId;
  /* núcleo de deleteSequenceMedia, sin el diálogo de confirmación */
  state.media=state.media.filter(x=>x.id!==borrada); state.openSeqs=state.openSeqs.filter(x=>x!==borrada);
  state.activeSeqId=state.openSeqs[state.openSeqs.length-1]; loadSeqIntoState(activeSeq());
  renderSeqBar(); renderTimeline(); render(); setTlScrollT((activeSeq()||{}).nestScrollT||0);
  const t=+(sc.scrollLeft/state.tl.pxPerSec).toFixed(1);
  return { encuadreEsperado:(activeSeq()||{}).nestScrollT, encuadreReal:t, correcto:Math.abs(t-((activeSeq()||{}).nestScrollT||0))<0.2 }; })()`);

/* F3 · una CARPETA arrastrada sobre una fila de medio no es destino */
out.F3_carpeta=await ev(`(function(){
  state.folders=['Carpeta A','Carpeta B']; state.mediaView='list'; state.mediaGroupBy='folder'; state.mediaFolder=null; state.selFolder=null;
  const libres=state.media.filter(x=>!isSeqMedia(x)); if(libres.length<2)return {err:'pocos medios'};
  libres[0].folder='Carpeta A'; libres[1].folder=null; renderMedia();
  const filaDe=m=>[...document.querySelectorAll('#mediaList .mitem')].find(el=>+el.dataset.id===m.id);
  const pt=el=>{ const r=el.getBoundingClientRect(); return {clientX:Math.round(r.left+r.width/2), clientY:Math.round(r.top+r.height/2)}; };
  const fArch=filaDe(libres[0]), fLibre=filaDe(libres[1]);
  if(!fArch||!fLibre)return {err:'filas no encontradas'};
  return {
    medioArrastrandoCarpeta_sobreArchivado: (t=>t?t.path:'(nada)')(_dropTargetAt(pt(fArch),true)),
    medioArrastrandoCarpeta_sobreSinArchivar: (t=>t?t.path:'(nada)')(_dropTargetAt(pt(fLibre),true)),
    medioArrastrandoMedio_sobreArchivado: (t=>t?t.path:'(nada)')(_dropTargetAt(pt(fArch))),
    carpetaNoAterrizaEnFilas: !_dropTargetAt(pt(fArch),true) && !_dropTargetAt(pt(fLibre),true) }; })()`);

/* F4 · el realce de la fila se limpia al entrar el cursor en una pista */
out.F4_realce=await ev(`(function(){
  const fila=document.querySelector('#mediaList .mitem'); if(!fila)return {err:'sin filas'};
  fila.classList.add('dragover');
  const antes=document.querySelectorAll('#mediaList .mitem.dragover').length;
  _clearDropFX();
  return { realzadasAntes:antes, realzadasDespues:document.querySelectorAll('#mediaList .mitem.dragover').length,
    limpia:document.querySelectorAll('#mediaList .mitem.dragover').length===0 }; })()`);

/* F5 · la pestaña activa se ve tras repintar, y el desvanecido avisa de que hay más */
out.F5_pestanas=await ev(`(function(){ const bar=document.getElementById('seqTabs');
  for(let i=0;i<10;i++){ const m=newSeqMedia('Secuencia larga '+(i+2),60,2048,2048,null,null,'dome',180); state.media.push(m); state.openSeqs.push(m.id); }
  const ultima=state.openSeqs[state.openSeqs.length-1];
  state.activeSeqId=ultima; renderSeqBar();
  const act=bar.querySelector('.seqtab.on');
  const visible = act && act.offsetLeft>=bar.scrollLeft-1 && (act.offsetLeft+act.offsetWidth)<=bar.scrollLeft+bar.clientWidth+1;
  const alFinal={ ovfL:bar.classList.contains('ovf-l'), ovfR:bar.classList.contains('ovf-r'), scrollLeft:Math.round(bar.scrollLeft) };
  /* repintar NO debe devolver la vista al origen */
  const sl=bar.scrollLeft; renderSeqBar(); const trasRepintar=Math.round(bar.scrollLeft);
  bar.scrollLeft=0; seqTabsOvf();
  const alPrincipio={ ovfL:bar.classList.contains('ovf-l'), ovfR:bar.classList.contains('ovf-r') };
  return { desbordado:bar.scrollWidth>bar.clientWidth, activaVisible:!!visible, alFinal, trasRepintar,
    conservaElScroll:Math.abs(trasRepintar-Math.round(sl))<2, alPrincipio,
    avisaSoloDondeQuedaAlgo: alPrincipio.ovfR && !alPrincipio.ovfL && alFinal.ovfL }; })()`);

out.errs=await ev(`window.__errs.slice(0,20)`);
console.log(JSON.stringify(out,null,1));
ws.close();
