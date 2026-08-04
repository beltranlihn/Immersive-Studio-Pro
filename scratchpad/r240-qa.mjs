/* [R240] La «segunda pasada de QA» que AUDITORIA-2026-07.md dejó pendiente:
   trim a duración 0 · borrar media en uso · borrar la secuencia activa · marcadores ·
   work in/out invertido · zoom extremo del timeline. Sonda, no arreglo: reporta anomalías. */
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
 addEventListener('unhandledrejection',e=>__errs.push('rej: '+String((e.reason&&e.reason.message)||e.reason)));
 if(!window.__errHook){ window.__errHook=1; const ce=console.error; console.error=function(){try{__errs.push('con: '+[...arguments].map(String).join(' '));}catch(_){}return ce.apply(console,arguments);}; }
 return 1; })()`);
await ev(`state.dirty=false;1`);
await ev(`(async()=>{try{await startDemoProject('dome');}catch(e){window.__d=String(e);}})()`); await wait(2600);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){} return 1;})()`); await wait(600);

/* Q1 · trim hasta duración 0 (y más allá) */
out.Q1_trim0=await ev(`(function(){ const c=state.clips.find(x=>!x.adjust); if(!c)return {err:'sin clips'};
  const d0=c.dur, s0=c.start; const r={durInicial:+d0.toFixed(3)};
  try{ trimItem(c,'r', -(d0+5)); }catch(e){ r.errDer=String(e.message||e); }   // arrastrar el borde derecho MUY a la izquierda
  r.trasTrimDerecho={dur:+c.dur.toFixed(4), start:+c.start.toFixed(4)};
  try{ trimItem(c,'l', d0+5); }catch(e){ r.errIzq=String(e.message||e); }      // y el izquierdo muy a la derecha
  r.trasTrimIzquierdo={dur:+c.dur.toFixed(4), start:+c.start.toFixed(4)};
  r.duracionPositiva = c.dur>0; r.sinNaN = isFinite(c.dur)&&isFinite(c.start);
  c.dur=d0; c.start=s0; renderTimeline();
  return r; })()`);

/* Q2 · borrar un medio EN USO + deshacer */
out.Q2_borrarMediaEnUso=await ev(`(function(){ const c=state.clips.find(x=>x.mediaId!=null); if(!c)return {err:'sin clips con media'};
  const mid=c.mediaId, antes=state.clips.filter(x=>x.mediaId===mid).length;
  const r={clipsQueLoUsaban:antes};
  try{ deleteMedia(mid); }catch(e){ r.errBorrar=String(e.message||e); }
  r.trasBorrar={ mediaExiste:!!mediaById(mid), clipsHuerfanos:state.clips.filter(x=>x.mediaId===mid).length };
  try{ render(); }catch(e){ r.errRenderTrasBorrar=String(e.message||e); }
  try{ undo(); }catch(e){ r.errUndo=String(e.message||e); }
  r.trasDeshacer={ mediaVuelve:!!mediaById(mid), clips:state.clips.filter(x=>x.mediaId===mid).length };
  r.deshacerRecupera = !!mediaById(mid) && state.clips.filter(x=>x.mediaId===mid).length===antes;
  return r; })()`);

/* Q3 · work in/out INVERTIDO (out < in) */
out.Q3_workInvertido=await ev(`(function(){ const r={};
  state.workIn=8; state.workOut=2;                       // invertido a propósito
  try{ renderWork(); r.renderWorkOk=true; }catch(e){ r.errRenderWork=String(e.message||e); }
  try{ r.duracion=+duration().toFixed(3); }catch(e){ r.errDuracion=String(e.message||e); }
  /* el bucle de reproducción usa el rango: no debe colgarse ni saltar hacia atrás sin fin */
  try{ state.playhead=5; const antes=state.playhead; r.loopBtn=!!document.getElementById('loopBtn'); r.playheadTrasRango=antes; }catch(e){ r.errLoop=String(e.message||e); }
  /* render-ahead sobre un rango invertido */
  try{ const t0=state.workIn, t1=state.workOut; r.rangoRenderAhead=[t0,t1]; r.rangoInvertidoDetectado=(t1<=t0); }catch(e){}
  state.workIn=null; state.workOut=null; renderWork();
  return r; })()`);

/* Q4 · marcadores: crear / renombrar / borrar / navegar */
out.Q4_marcadores=await ev(`(function(){ const r={};
  state.markers=[]; state.playhead=3;
  try{ addMarker(); }catch(e){ r.errAdd=String(e.message||e); }
  r.trasCrear=state.markers.length;
  const mk=state.markers[0];
  if(mk){ r.tieneTiempo=isFinite(mk.time); r.tieneId=mk.id!=null;
    try{ state.selMarkerId=mk.id; state.markers=state.markers.filter(x=>x.id!==mk.id); }catch(e){ r.errDel=String(e.message||e); } }
  r.trasBorrar=state.markers.length;
  /* selección exclusiva marcador ⇄ clip (regresión de R223) */
  try{ state.playhead=4; addMarker(); const m2=state.markers[0]; state.selMarkerId=m2.id;
    const c=state.clips.find(x=>!x.adjust); if(c){ state.selId=c.id; state.selIds=[c.id]; if(typeof selectClip==='function')selectClip(c.id); }
    r.exclusiva={selMarker:state.selMarkerId, selClip:state.selId};
  }catch(e){ r.errExcl=String(e.message||e); }
  state.markers=[]; state.selMarkerId=null; renderTimeline();
  return r; })()`);

/* Q5 · zoom extremo del timeline (mínimo y máximo) */
out.Q5_zoom=await ev(`(function(){ const sc=document.getElementById('tlscroll'); const r={};
  const pps0=state.tl.pxPerSec;
  const probar=(pps,et)=>{ state.tl.pxPerSec=pps; let err=null;
    try{ renderTimeline(); drawRuler&&drawRuler(); }catch(e){ err=String(e.message||e); }
    return {pps:+state.tl.pxPerSec.toFixed(4), anchoContenido:sc.scrollWidth, err,
      anchoFinito:isFinite(sc.scrollWidth)&&sc.scrollWidth>0}; };
  r.minimo=probar(0.0001,'min'); r.maximo=probar(1e7,'max');
  r.topeAplicado={min:r.minimo.pps, max:r.maximo.pps, TL_PPS_MAX:(typeof TL_PPS_MAX!=='undefined'?TL_PPS_MAX:null)};
  state.tl.pxPerSec=pps0; renderTimeline();
  return r; })()`);

/* Q6 · borrar la secuencia ACTIVA con una sola secuencia abierta */
out.Q6_borrarUnicaSeq=await ev(`(function(){ const r={}; const seqs=state.media.filter(isSeqMedia);
  r.secuencias=seqs.length; r.abiertas=(state.openSeqs||[]).length;
  /* el guard: nunca puede quedar el proyecto sin secuencia */
  const antes=state.openSeqs.slice();
  try{ closeSeqTab(state.activeSeqId); }catch(e){ r.errCerrar=String(e.message||e); }
  r.trasCerrarLaUnica={ abiertas:(state.openSeqs||[]).length, activaSigueSiendoValida:!!isSeqMedia(activeSeq()) };
  r.guardFunciona = (state.openSeqs||[]).length>=1 && !!isSeqMedia(activeSeq());
  state.openSeqs=antes; return r; })()`);

out.errs=await ev(`window.__errs.slice(0,25)`);
console.log(JSON.stringify(out,null,1));
ws.close();
