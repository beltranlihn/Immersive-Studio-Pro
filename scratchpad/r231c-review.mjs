/* [R231c] Verificación de los hallazgos de la revisión del diff de R231/R231b.
   Uso: npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r231c-review.mjs           */
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
await ev(`(async()=>{try{await startDemoProject('room');}catch(e){window.__d=String(e);}})()`); await wait(2500);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){}
 document.querySelector('#viewModeSeg button[data-v="2d"]').click(); state.playhead=6; resize(); renderTimeline(); return 1;})()`); await wait(700);

const out={};

/* 1 · ALTA — en la emergente, apagar Floor tiene que dar MUROS SOLOS, no el lienzo entero.
   El panel del piso empieza en la fila `stripH`: si el panel único llega hasta `sh`, el piso está dentro. */
out.f1_visorFloor = await ev(`(function(){ const as=activeSeq(), sh=as.h, wallsH=as.room.stripH;
  const lee=()=>{ const ps=vpPanels(); return {n:ps.length, surf:ps[0].surf, ry1:ps[0].ry1, w:Math.round(ps[0].w)}; };
  const fv=_vFloor, vp=_vPaint;
  _vPaint=true; _vFloor=true;  const conPiso=lee();
            _vFloor=false;     const sinPiso=lee();
  _vFloor=fv; _vPaint=vp;
  return { canvasH:sh, wallsH, conPiso, sinPiso,
    sinPiso_esMurosSolos: sinPiso.n===1 && sinPiso.surf==='wall' && sinPiso.ry1===wallsH,
    sinPiso_metiaElLienzoEntero: sinPiso.ry1===sh }; })()`);

/* 2 · el encuadre propio de la emergente se reinicia al abrirla */
out.f2_vVpReset = await ev(`(function(){ _vVp={x:1}; vVpState('wall').zoom=6; _vFloor=false;
  const antes=JSON.parse(JSON.stringify(_vVp));
  const abrir=String(openViewerWindow); const reinicia=/_vVp\\s*=\\s*\\{\\}/.test(abrir)&&/_vFloor\\s*=\\s*true/.test(abrir);
  _vVp={}; _vFloor=true;
  return {antesTeniaEstado:Object.keys(antes).length>0, openViewerWindowLoReinicia:reinicia}; })()`);

/* 3 · el fantasma del punto no se queda congelado al girar la rueda */
out.f3_hoverRueda = await ev(`(function(){ const c=state.clips.find(c=>(state.lanes[c.lane]||{}).surf==='wall');
  state.selId=c.id; state.selIds=[c.id];
  if(!c.penMasks||!c.penMasks.length)c.penMasks=[{pts:[[0.2,0.2],[0.8,0.2],[0.8,0.8],[0.2,0.8]]}];
  _maskEdit={id:c.id,mi:0}; _maskHover={ax:1,ay:2,bx:3,by:4,x:5,y:6}; _maskHoverSig='x';
  const g=document.getElementById('grid'), r=g.getBoundingClientRect();
  g.dispatchEvent(new WheelEvent('wheel',{clientX:r.left+200,clientY:r.top+150,deltaY:-240,bubbles:true,cancelable:true}));
  const tras=_maskHover; endMaskEdit(true);
  return {habiaFantasma:true, trasLaRueda:tras}; })()`);

/* 4 · el divisor no se pinta en la emergente */
out.f4_divisor = await ev(`(function(){ const src=String(drawVpDivider); return {tieneGuardaVPaint:/_vPaint\\s*\\)\\s*return/.test(src)}; })()`);

/* 5 · el botón Floor de la barra de la emergente sólo donde hay partición */
out.f5_barraLegacy = await ev(`(function(){ const src=String(viewerBuildDoc); return {barraExigeSurfLanes:/hayPiso[\\s\\S]{0,160}roomSurfLanes\\(\\)/.test(src)}; })()`);

/* 6 · el forzado automático del piso NO pisa la preferencia guardada del usuario */
out.f6_pref = await ev(`(function(){
  // el usuario apaga el piso a propósito
  document.querySelector('#dispSeg button[data-d="floor"]').click();
  const trasBoton=localStorage.getItem('ispRoomVp');
  // se reabre una sala con piso → el forzado lo enciende en memoria
  roomVpAutoFloor(true);
  const enMemoria=state.view.roomFloor;
  // ...y se ajusta el divisor, que también guarda
  state.view.roomDiv=0.5; saveRoomVpPrefs();
  const trasDivisor=localStorage.getItem('ispRoomVp');
  // ahora el usuario SÍ pulsa el botón: a partir de aquí manda él
  document.querySelector('#dispSeg button[data-d="floor"]').click();
  const trasBoton2=localStorage.getItem('ispRoomVp');
  return {trasBoton, enMemoria, trasDivisor, sobrevive:JSON.parse(trasDivisor).floor===false, trasBoton2}; })()`);

/* 7 · las cuatro vías de creación llaman a roomVpAutoFloor */
out.f7_vias = await ev(`(function(){ const n=s=>(String(s).match(/roomVpAutoFloor\\(/g)||[]).length;
  return {newRoomProject:n(newRoomProject), loadProject:n(loadProject),
          newSequenceDialog:n(newSequenceDialog), applyRoomGeometry:n(applyRoomGeometry)}; })()`);

/* el editor no cambia: apagar el piso sigue dando muros solos a ancho completo */
out.editorSigueIgual = await ev(`(function(){ localStorage.removeItem('ispRoomVp'); state.view.roomFloor=undefined; _vpFloorUserSet=false; updModeUI(); resize();
  const con=vpPanels().length;
  document.querySelector('#dispSeg button[data-d="floor"]').click();
  const ps=vpPanels(); const sin={n:ps.length,surf:ps[0].surf,w:Math.round(ps[0].w),cw:Math.round(view.cw)};
  document.querySelector('#dispSeg button[data-d="floor"]').click();
  return {conPiso:con, sinPiso:sin, vuelta:vpPanels().length}; })()`);

out.errs = await ev(`window.__errs.slice(0,20)`);
console.log(JSON.stringify(out,null,1));
ws.close();
