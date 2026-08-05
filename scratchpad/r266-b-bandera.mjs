/* [R266b] ¿Que pasa si el gesto del divisor NO termina en un pointerup que llegue a la ventana (soltar fuera,
   pointercancel, perder el foco)? `_tlResizing` se queda en true y `clampTimelineH` deja de recortar PARA SIEMPRE
   -> el hueco muerto bajo la ultima pista se queda ahi, que es justo lo que se ve en la grabacion. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||r.result.exceptionDetails.text)):res(r.result.result.value)));
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`);
await wait(1400);
await ev(`(function(){ while(state.lanes.filter(l=>l.kind==='video').length<7) state.lanes.push({id:uid(),name:'V'+(state.lanes.length+1),tag:'V'+(state.lanes.length+1),kind:'video',surf:'wall'});
  for(const l of state.lanes){ l.collapsed=false; l.h=null; } renderTimeline(); return state.lanes.length; })()`);
await wait(400);
await ev(`window.__mide=function(){ const sc=document.querySelector('#tlscroll'), tl=document.querySelector('.timeline');
  const filas=[...document.querySelectorAll('#tracks .lane')];
  const dibujado=filas.reduce((s,r)=>s+r.getBoundingClientRect().height,0);
  return { panel:Math.round(tl.getBoundingClientRect().height), hueco:Math.round(tlHueco(sc)),
           muerto:Math.round(tlHueco(sc)-dibujado), resizing:_tlResizing }; };1`);
console.log('estado inicial: '+JSON.stringify(await ev(`__mide()`)));
/* gesto INTERRUMPIDO: pointerdown + movimientos, y el pointerup NUNCA llega (se solto fuera de la ventana) */
const roto=await ev(`(async function(){ const h=document.querySelector('#tlResize'); const r=h.getBoundingClientRect();
  const x=r.left+r.width/2, y0=r.top+r.height/2;
  const tl=document.querySelector('.timeline'); tl.style.height='220px'; _tlAltoManual=true; resize(); renderTimeline();
  await new Promise(s=>setTimeout(s,80));
  h.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:x,clientY:y0}));
  for(let k=1;k<=10;k++){ window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:x,clientY:y0-k*40})); await new Promise(s=>setTimeout(s,20)); }
  /* aqui NO se despacha pointerup: el dedo se levanto fuera */
  await new Promise(s=>setTimeout(s,200)); return __mide(); })()`);
console.log('tras un gesto SIN pointerup: '+JSON.stringify(roto));
/* y ahora se pliegan las pistas, que normalmente recortaria el panel */
const luego=await ev(`(async function(){ for(const l of state.lanes) l.collapsed=true; renderTimeline(); await new Promise(s=>setTimeout(s,200)); return __mide(); })()`);
console.log('luego se PLIEGAN las 8 pistas (el panel deberia recortarse): '+JSON.stringify(luego));
console.log('\n=> hueco muerto: '+luego.muerto+' px · _tlResizing quedo en: '+luego.resizing+(luego.muerto>8?'   *** EL GLITCH REPRODUCIDO':''));
ws.close();
