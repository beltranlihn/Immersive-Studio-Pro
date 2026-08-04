/* [R239] Diagnóstico de los cuatro ajustes de Beltrán, ANTES de tocar nada. */
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

/* 1 · entrar a un nest desde un playhead LEJANO */
out['1_nest']=await ev(`(function(){
  const sc=document.getElementById('tlscroll');
  /* clip lejos + cabezal ahí, como el minuto 55 de Beltrán */
  const li=state.lanes.findIndex(l=>l.kind==='video');
  const c=_demoAddShape('rect','#C0C0C0',li,600,6,{}); state.selId=c.id; state.selIds=[c.id];
  state.playhead=600; renderTimeline(); followPlayhead&&followPlayhead(); 
  sc.scrollLeft=600*state.tl.pxPerSec-200; renderTimeline();
  const antes={playhead:state.playhead, scrollLeft:Math.round(sc.scrollLeft), pps:state.tl.pxPerSec, seq:state.activeSeqId};
  const nc=nestSelection();                                  // crea el nido en 600s
  const nest=state.clips.find(x=>{const m=mediaById(x.mediaId);return m&&isSeqMedia(m)&&m.nestClips&&m.nestClips.length;});
  const nid=nest?nest.mediaId:null;
  openSeq(nid); renderTimeline();
  const dentro={playhead:state.playhead, scrollLeft:Math.round(sc.scrollLeft), seq:state.activeSeqId,
    primerClipEmpiezaEn: Math.min(...state.clips.map(x=>x.start)),
    anchoVisible:sc.clientWidth, clipVisible:null};
  dentro.clipVisible = (dentro.primerClipEmpiezaEn*state.tl.pxPerSec) >= dentro.scrollLeft &&
                       (dentro.primerClipEmpiezaEn*state.tl.pxPerSec) <= dentro.scrollLeft+sc.clientWidth;
  return {antes, dentro}; })()`);

/* 2 · a qué carpeta van los archivos soltados en la lista */
out['2_drop']=await ev(`(function(){
  state.folders=['Carpeta A']; state.mediaView='list'; state.mediaGroupBy='folder'; state.mediaFolder=null; state.selFolder=null;
  const m=state.media.find(x=>!isSeqMedia(x)); if(m)m.folder='Carpeta A';
  renderMedia();
  const filas=[...document.querySelectorAll('#mediaList .mitem')].map(el=>({id:el.dataset.id, tieneCarpeta:!!(mediaById(+el.dataset.id)||{}).folder}));
  const hdr=[...document.querySelectorAll('#mediaList .folderhdr')].map(el=>el.dataset.fname);
  /* lo que wireDrop resolvería si el drop cae sobre una FILA de clip (no sobre la cabecera) */
  const objetivoActual = (state.mediaView==='grid')?state.mediaFolder:(state.selFolder||state.mediaFolder||null);
  return { cabeceras:hdr, filas, objetivoSiSueltasSobreUnClip:objetivoActual,
    filaLlevaSuCarpetaEnElDOM: filas.length? ('folder' in (document.querySelector('#mediaList .mitem').dataset)) : null }; })()`);

/* 3 · menú contextual de media con UN solo clip seleccionado */
out['3_ctx']=await ev(`(function(){
  const m=state.media.find(x=>!isSeqMedia(x)&&x.kind!=='audio'&&x.kind!=='adjust'); if(!m)return {err:'sin media'};
  state.selMediaId=m.id; state.selMediaIds=[m.id];
  const ids=selectedMediaIds(); const comp=ids.map(mediaById).filter(x=>x&&x.kind!=='audio'&&x.kind!=='adjust'&&!isSeqMedia(x));
  return { seleccionados:ids.length, composables:comp.length, ofreceCompose: comp.length>=2 }; })()`);

/* 4 · barra de secuencias */
out['4_seqtabs']=await ev(`(function(){ const el=document.getElementById('seqTabs'); const cs=getComputedStyle(el);
  for(let i=0;i<8;i++){ const m=newSeqMedia('Seq '+(i+2),60,2048,2048,null,null,'dome',180); state.media.push(m); state.openSeqs.push(m.id); }
  renderSeqBar();
  return { scrollbarWidth:cs.scrollbarWidth, overflowX:cs.overflowX,
    clientWidth:el.clientWidth, scrollWidth:el.scrollWidth, offsetHeight:el.offsetHeight, clientHeight:el.clientHeight,
    barraOcupaAlto: el.offsetHeight-el.clientHeight,
    desbordado: el.scrollWidth>el.clientWidth,
    tieneWheel: !!el.onwheel }; })()`);

out.errs=await ev(`window.__errs.slice(0,20)`);
console.log(JSON.stringify(out,null,1));
ws.close();
