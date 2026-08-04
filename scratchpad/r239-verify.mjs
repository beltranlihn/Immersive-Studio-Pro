/* [R239] Verificación de los cuatro ajustes de Beltrán. */
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

/* 1 · entrar a un nido creado lejos → vista al inicio; volver al padre → donde estaba */
out['1_nest']=await ev(`(function(){ const sc=document.getElementById('tlscroll');
  const li=state.lanes.findIndex(l=>l.kind==='video');
  const c=_demoAddShape('rect','#C0C0C0',li,600,6,{}); state.selId=c.id; state.selIds=[c.id];
  state.playhead=600; renderTimeline(); sc.scrollLeft=600*state.tl.pxPerSec-200; renderTimeline();
  const padreId=state.activeSeqId, antes={playhead:state.playhead, scrollT:+(sc.scrollLeft/state.tl.pxPerSec).toFixed(2)};
  nestSelection();
  const nest=state.clips.find(x=>{const m=mediaById(x.mediaId);return m&&isSeqMedia(m)&&m.nestClips&&m.nestClips.length;});
  openSeq(nest.mediaId);
  const primer=Math.min(...state.clips.map(x=>x.start));
  const dentro={playhead:state.playhead, scrollT:+(sc.scrollLeft/state.tl.pxPerSec).toFixed(2),
    primerClipEmpiezaEn:primer,
    clipVisible:(primer*state.tl.pxPerSec)>=sc.scrollLeft-1 && (primer*state.tl.pxPerSec)<=sc.scrollLeft+sc.clientWidth };
  sc.scrollLeft=3*state.tl.pxPerSec; state.playhead=3;
  switchSeq(padreId);
  const vuelta={playhead:state.playhead, scrollT:+(sc.scrollLeft/state.tl.pxPerSec).toFixed(2)};
  switchSeq(nest.mediaId);
  const reentra={playhead:state.playhead, scrollT:+(sc.scrollLeft/state.tl.pxPerSec).toFixed(2)};
  switchSeq(padreId);
  return {antes, dentro, vuelta, reentra,
    entraAlInicio: dentro.scrollT<0.01 && dentro.playhead===0 && dentro.clipVisible,
    vuelveDondeEstaba: Math.abs(vuelta.scrollT-antes.scrollT)<0.05 && vuelta.playhead===600 }; })()`);

/* 2 · soltar sobre un medio de una carpeta = esa carpeta */
out['2_drop']=await ev(`(function(){
  state.folders=['Carpeta A']; state.mediaView='list'; state.mediaGroupBy='folder'; state.mediaFolder=null; state.selFolder=null;
  const m=state.media.find(x=>!isSeqMedia(x)); if(!m)return {err:'sin media'}; m.folder='Carpeta A';
  renderMedia();
  const fila=[...document.querySelectorAll('#mediaList .mitem')].find(el=>+el.dataset.id===m.id);
  if(!fila)return {err:'fila no encontrada'};
  const r=fila.getBoundingClientRect(); const cx=Math.round(r.left+r.width/2), cy=Math.round(r.top+r.height/2);
  const t=_dropTargetAt({clientX:cx,clientY:cy});
  const list=document.getElementById('mediaList'), lr=list.getBoundingClientRect();
  const t2=_dropTargetAt({clientX:Math.round(lr.left+lr.width/2), clientY:Math.round(lr.bottom-4)});
  return { sobreMedioDeCarpetaA:t?t.path:null, resaltaCabecera:!!(t&&t.el&&t.el.classList.contains('folderhdr')),
    sobreElFondo:t2?t2.path:'(nada)', folderAtRetirada:(typeof folderAt==='undefined') }; })()`);

/* 3 · compose con UN solo medio, en lista y en cuadrícula */
out['3_compose']=await ev(`(function(){ const m=state.media.find(x=>!isSeqMedia(x)&&x.kind!=='audio'&&x.kind!=='adjust');
  state.selMediaId=m.id; state.selMediaIds=[m.id];
  const res={};
  for(const vista of ['list','grid']){ state.mediaView=vista; renderMedia();
    let cap=null; const om=window.openMenu; window.openMenu=(x,y,items)=>{ cap=items; };
    try{ openMediaCtx({preventDefault(){},clientX:10,clientY:10}, m); } finally { window.openMenu=om; }
    const et=(cap||[]).filter(i=>i&&i.label).map(i=>i.label);
    res[vista]={ ofreceCompose: et.some(l=>/composition|composici/i.test(l)), primeras:et.slice(0,2) }; }
  let abrio=false; try{ openCompose('ring',null,null,null,[m.id]);
    const ov=document.getElementById('cMedia'); abrio=!!ov;
    const marcados=ov?[...ov.querySelectorAll('input:checked')].length:0;
    document.querySelectorAll('.overlay').forEach(o=>o.remove());
    res.compositor={abrio, marcados};
  }catch(e){ res.compositor={err:String(e.message||e)}; }
  return res; })()`);

/* 4 · barra de secuencias: sin scrollbar y con rueda */
out['4_seqtabs']=await ev(`(function(){ const el=document.getElementById('seqTabs');
  for(let i=0;i<8;i++){ const m=newSeqMedia('Seq '+(i+2),60,2048,2048,null,null,'dome',180); state.media.push(m); state.openSeqs.push(m.id); }
  renderSeqBar(); const cs=getComputedStyle(el);
  const antes=el.scrollLeft;
  el.dispatchEvent(new WheelEvent('wheel',{deltaY:120,bubbles:true,cancelable:true}));
  const tras=el.scrollLeft;
  el.dispatchEvent(new WheelEvent('wheel',{deltaY:-400,bubbles:true,cancelable:true}));
  const vuelta=el.scrollLeft;
  return { scrollbarWidth:cs.scrollbarWidth, offsetHeight:el.offsetHeight, clientHeight:el.clientHeight,
    barraOcupaAlto: el.offsetHeight-el.clientHeight, desbordado: el.scrollWidth>el.clientWidth,
    scrollAntes:antes, trasRueda:tras, trasRuedaAtras:vuelta,
    laRuedaDesplaza: tras>antes, vuelveAlPrincipio: vuelta===0 }; })()`);

out.errs=await ev(`window.__errs.slice(0,20)`);
console.log(JSON.stringify(out,null,1));
ws.close();
