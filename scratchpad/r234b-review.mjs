/* [R234b] Verificación de los hallazgos de la revisión del diff de R233/R233b/R234.
   Uso: npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r234b-review.mjs           */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const pend=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;pend.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

await ev(`window.__errs=[];addEventListener('error',e=>__errs.push(String(e.message||e)));
 addEventListener('unhandledrejection',e=>__errs.push('rej: '+String((e.reason&&e.reason.message)||e.reason)));
 const ce=console.error;console.error=function(){try{__errs.push('con: '+[...arguments].map(String).join(' '));}catch(_){}return ce.apply(console,arguments);};
 localStorage.removeItem('ispRoomVp'); 1`);
await ev(`window.__drag=function(x0,y0,x1,y1,o){o=o||{};const g=document.getElementById('grid'),r=g.getBoundingClientRect();
 const mk=(t,x,y)=>new PointerEvent(t,{clientX:r.left+x,clientY:r.top+y,button:0,buttons:1,bubbles:true,pointerId:1,shiftKey:!!o.shift,altKey:!!o.alt});
 g.dispatchEvent(mk('pointerdown',x0,y0)); if(o.dos)g.dispatchEvent(mk('pointermove',x0,y0));
 g.dispatchEvent(mk('pointermove',x1,y1)); g.dispatchEvent(mk('pointerup',x1,y1));
 window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:1})); return 1;};1`);
await ev(`(async()=>{try{await startDemoProject('room');}catch(e){window.__d=String(e);}})()`); await wait(2500);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){}
 document.querySelector('#viewModeSeg button[data-v="2d"]').click(); state.playhead=6; resize(); renderTimeline(); return 1;})()`); await wait(700);

const out={};

/* 1 · el límite del muestreo es la SUPERFICIE del panel, no la banda del lienzo.
   El panel del piso recorta en el dock: sus costados tienen VACÍO al lado y necesitan acotado. */
out.f1_limites = await ev(`(function(){ const as=activeSeq(), room=as.room;
  const fw=(room.walls||[]).find(w=>w.role==='Front')||room.walls[0];
  const banda=compContentLim();
  const ps=vpPanels(); const lim=ps.map(P=>({surf:P.surf, lim:(P.surf?compLimForRect(P.rx0,P.ry0,P.rx1,P.ry1):compContentLim()).map(v=>+v.toFixed(6))}));
  const piso=lim.find(l=>l.surf==='floor'), muro=lim.find(l=>l.surf==='wall');
  return { bandaLienzo:banda.map(v=>+v.toFixed(6)), lim,
    fx0:fw.x0, fx1:fw.x1, anchoLienzo:as.w,
    pisoAcotaSuCostadoDerecho: !!(piso && piso.lim[2]<banda[2]-1e-9),
    pisoIzqCoincidePorqueFrontEmpiezaEn0: !!(piso && fw.x0===0 && Math.abs(piso.lim[0]-banda[0])<1e-9),
    murosNoAcotanCostados: !!(muro && Math.abs(muro.lim[0]-banda[0])<1e-9 && Math.abs(muro.lim[2]-banda[2])<1e-9),
    murosAcotanElPie: !!(muro && muro.lim[1]>banda[1]+1e-9) }; })()`);

/* 2 · un export POR MURO sigue acotando a la banda (los muros son UNA superficie contigua),
   pero un trabajo de PISO acota a su propio rect. Se lee el uniforme que queda tras la llamada. */
out.f2_export = await ev(`(function(){ const as=activeSeq(), room=as.room, sw=as.w, sh=as.h;
  const wallsH=room.stripH, floorH=sh-wallsH; const fw=(room.walls||[]).find(w=>w.role==='Front')||room.walls[0];
  const leeLim=()=>{ const v=gl.getUniform(PB,LB.uvlim); return [...v].map(x=>+x.toFixed(6)); };
  const bak={df:_drawFlat,rw:_roomWrap,ca:_compAspect};
  const R=(w)=>{ renderExportFrame(state.playhead,256,1,w); return leeLim(); };
  const right=(room.walls||[]).find(w=>w.role==='Right')||room.walls[1];
  const limMuro=R({kind:'wall',role:'Right',x0:right.x0,x1:right.x1,y0:0,y1:right.pxH,pxW:right.pxW,pxH:right.pxH,stripW:sw,stripH:sh});
  const limPiso=R({kind:'floor',x0:fw.x0,x1:fw.x1,y0:wallsH,y1:wallsH+floorH,pxW:room.floor.pxW,pxH:room.floor.pxH,stripW:sw,stripH:sh});
  _drawFlat=bak.df; _roomWrap=bak.rw; _compAspect=bak.ca; render();
  const banda=compContentLim().map(v=>+v.toFixed(6));
  return { banda, limMuro, limPiso,
    muroUsaLaBanda: Math.abs(limMuro[0]-banda[0])<1e-6 && Math.abs(limMuro[2]-banda[2])<1e-6,
    pisoAcotaSuCostadoDerecho: limPiso[2]<banda[2]-1e-9,
    pisoAcotaElTecho: limPiso[3]<banda[3]-1e-9 }; })()`);

/* 3 · el desfase del agarre se mide en la BASE (evalP), no en lo que se ve (evalR = base + movimiento +
   modulación). Se compara el `vdrag.off` real contra las dos fórmulas posibles con una modulación puesta. */
out.f3_agarreEnLaBase = await ev(`(function(){ const c=state.clips.find(c=>(state.lanes[c.lane]||{}).surf==='wall');
  state.selId=c.id; state.selIds=[c.id];
  Object.assign(c.props,{x:0,y:0,scale:60,rot:0}); delete c.kf; c.anim=null; c.mod=null;
  /* Se inyecta un desplazamiento PROCEDIMENTAL de 30 en x parcheando evalR — que es justo la diferencia entre lo
     que se VE (flatPlace usa evalR) y lo que se ESCRIBE (manualEdit escribe la base). No depende de la forma
     interna de ningún preset de movimiento. */
  const _R=evalR; const ANIM=30;
  window.evalR=function(cc,p,t){ const v=_R(cc,p,t); return (cc===c&&p==='x')?(v+ANIM):v; };
  try{
    render();
    const m=mediaById(c.mediaId), CP=clipPanel(c), M=flatMap(CP), P=flatPlace(c,m,state.playhead,clipSurfA(c));
    const pt=M.px(P.fc[0]/M.Fx,P.fc[1]/M.Fy);          // donde SE VE el clip, ya con la animación
    const g=document.getElementById('grid'), r=g.getBoundingClientRect();
    const modoEn=(dx)=>{ g.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.left+pt[0]+dx,clientY:r.top+pt[1],button:0,buttons:1,bubbles:true,pointerId:1}));
      const md=vdrag&&vdrag.mode; window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:1})); return md; };
    // ARRASTRE del cuerpo: hay que caer lejos de los tiradores, que están en el borde
    const base0=evalP(c,'x',state.playhead), modoCuerpo=modoEn(3);
    __drag(pt[0]+3,pt[1], pt[0]+4,pt[1]);
    const base1=evalP(c,'x',state.playhead);
    // ESCALA: se agarra el tirador de la esquina y se mueve 1 px
    const P2=flatPlace(c,mediaById(c.mediaId),state.playhead,clipSurfA(c));
    const esq=M.px((P2.fc[0]+P2.fx[0]+P2.fy[0])/M.Fx,(P2.fc[1]+P2.fx[1]+P2.fy[1])/M.Fy);
    render(); drawGrid2D();                             // recalcula _flatHandles en las coords actuales
    const baseR0=evalP(c,'x',state.playhead);
    __drag(esq[0],esq[1], esq[0]+1,esq[1]);
    const baseR1=evalP(c,'x',state.playhead);
    return { anim:ANIM, modoCuerpo,
      arrastre:{ base0:+base0.toFixed(3), base1:+base1.toFixed(3), salto:+(base1-base0).toFixed(3),
        absorbioLaAnimacion:Math.abs((base1-base0)-ANIM)<1, seQuedaCasiQuieto:Math.abs(base1-base0)<2 },
      escala:{ base0:+baseR0.toFixed(3), base1:+baseR1.toFixed(3), salto:+(baseR1-baseR0).toFixed(3),
        absorbioLaAnimacion:Math.abs((baseR1-baseR0)-ANIM)<1, seQuedaCasiQuieto:Math.abs(baseR1-baseR0)<2 } };
  } finally { window.evalR=_R; c.mod=null; render(); } })()`);

/* 4 · domo: el azimut queda normalizado a [0,360) aunque el agarre cruce el corte de rama */
// el proyecto está sucio de las pruebas anteriores: sin esto, startDemoProject abre el diálogo de descartar y el evaluate se cuelga
await ev(`state.dirty=false; 1`);
await ev(`(async()=>{try{await startDemoProject('dome');}catch(e){window.__d2=String(e);}})()`); await wait(2500);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){} resize(); return 1;})()`); await wait(600);
out.f4_azNormalizado = await ev(`(function(){
  const c=state.clips.find(c=>{const m=mediaById(c.mediaId);return m&&m.kind!=='audio';});
  if(!c)return {saltado:'sin clip de domo'};
  state.selId=c.id; state.selIds=[c.id];                        // la rama del domo sólo arrastra el clip SELECCIONADO
  c.props.az=5; c.props.el=45; c.props.size=60; delete c.kf; render();
  const f=azel2f(355,45), p=f2pix(f[0],f[1]);         // agarre al otro lado del corte de rama
  const f2=azel2f(5,45), p2=f2pix(f2[0],f2[1]);
  __drag(p[0],p[1], p2[0],p2[1]);
  const az=evalP(c,'az',state.playhead);
  return { azAntes:5, az:+az.toFixed(3), seMovio:Math.abs(az-5)>0.5, enRango: az>=0 && az<360 }; })()`);

out.errs = await ev(`window.__errs.slice(0,20)`);
console.log(JSON.stringify(out,null,1));
ws.close();
