/* [R240·2] Q1 y Q4 rehechas por el camino REAL:
   · trimItem espera un ITEM de arrastre (start0/dur0/inP0), no el clip, y el borde es 'L'/'R' en MAYÚSCULA
     — la primera pasada le pasó el clip y una 'r' minúscula, así que el NaN lo produjo la sonda.
   · la selección de clip que apaga el locator es la del gesto del timeline, no una asignación a state.selId. */
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

/* Q1 · trim hasta 0 y más allá, por los dos bordes, con el item que arma el drag */
out.Q1_trim=await ev(`(function(){ const c=state.clips.find(x=>!x.adjust&&x.mediaId!=null); if(!c)return {err:'sin clips'};
  const S=c.start, D=c.dur, I=c.inP||0;
  const mkIt=()=>({id:c.id,start0:c.start,dur0:c.dur,inP0:c.inP||0,kf0:JSON.parse(JSON.stringify(c.kf||{})),anim0:null});
  const rest=()=>{ c.start=S; c.dur=D; c.inP=I; };
  const r={durInicial:+D.toFixed(3), startInicial:+S.toFixed(3)};
  const san=()=>({dur:+c.dur.toFixed(4), start:+c.start.toFixed(4), inP:+(c.inP||0).toFixed(4),
    finito:isFinite(c.dur)&&isFinite(c.start)&&isFinite(c.inP||0), positiva:c.dur>0});
  trimItem(mkIt(),'R',-(D+5)); r.bordeDerechoAlFondo=san(); rest();
  trimItem(mkIt(),'L', D+5);   r.bordeIzquierdoAlFondo=san(); rest();
  trimItem(mkIt(),'R', 1e6);   r.bordeDerechoAlInfinito=san(); rest();
  trimItem(mkIt(),'L',-1e6);   r.bordeIzquierdoAlInfinito=san(); rest();
  r.todosSanos=[r.bordeDerechoAlFondo,r.bordeIzquierdoAlFondo,r.bordeDerechoAlInfinito,r.bordeIzquierdoAlInfinito].every(x=>x.finito&&x.positiva);
  renderTimeline(); return r; })()`);

/* Q4 · locator ⇄ clip: exclusión por el gesto REAL del timeline (keydown Enter sobre el clip enfocado) */
out.Q4_exclusiva=await ev(`(function(){ const r={};
  state.markers=[]; state.playhead=3; addMarker(); const mk=state.markers[0];
  state.selMarkerId=mk.id; renderTimeline();
  r.trasSeleccionarLocator={selMarker:state.selMarkerId, selClip:state.selId};
  const c=state.clips.find(x=>!x.adjust); const cd=document.querySelector('.clip[data-clip="'+c.id+'"]');
  if(!cd){ r.err='clip sin nodo'; return r; }
  /* clic REAL sobre el cuerpo del clip: el camino del keydown depende de :focus-visible, que no se puede
     forzar desde un script, y la sonda daba falsos negativos. */
  const rc=cd.getBoundingClientRect(), px=Math.round(rc.left+rc.width/2), py=Math.round(rc.top+rc.height/2);
  const opt={clientX:px,clientY:py,button:0,buttons:1,bubbles:true,cancelable:true,pointerId:1,isPrimary:true};
  cd.dispatchEvent(new PointerEvent('pointerdown',opt));
  window.dispatchEvent(new PointerEvent('pointerup',{...opt,buttons:0}));
  r.trasSeleccionarClip={selMarker:state.selMarkerId, selClip:state.selId};
  r.clipApagaElLocator = (state.selMarkerId==null && state.selId===c.id);
  /* y al revés: seleccionar el locator apaga el clip */
  if(typeof selectMarker==='function'){ try{ selectMarker(mk.id); }catch(e){} }
  else { state.selMarkerId=mk.id; if(typeof laneDesel==='function')laneDesel(); }
  r.trasVolverAlLocator={selMarker:state.selMarkerId, selClip:state.selId};
  state.markers=[]; state.selMarkerId=null; renderTimeline(); return r; })()`);

/* Q5b · el zoom guardado en el .isp se acota al cargar? */
out.Q5b_zoomPersistido=await ev(`(function(){ const pps0=state.tl.pxPerSec;
  const obj=JSON.parse(JSON.stringify(serProject())); obj.tl.pxPerSec=1e7;   // .isp con un zoom absurdo
  let err=null; try{ loadProject(obj); }catch(e){ err=String(e.message||e); }
  const sc=document.getElementById('tlscroll');
  const r={ ppsTrasCargar:state.tl.pxPerSec, anchoContenido:sc?sc.scrollWidth:null, err,
    TL_PPS_MAX:(typeof TL_PPS_MAX!=='undefined'?TL_PPS_MAX:null) };
  r.acotado = state.tl.pxPerSec<=(typeof TL_PPS_MAX!=='undefined'?TL_PPS_MAX:2400)+1e-6;
  state.tl.pxPerSec=pps0; renderTimeline(); return r; })()`);

out.errs=await ev(`window.__errs.slice(0,25)`);
console.log(JSON.stringify(out,null,1));
ws.close();
