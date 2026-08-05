/* [R267] La secuencia EXACTA de Beltran: achicar todas las pistas con Alt+rueda hasta el minimo y despues subir
   el contenedor. `wheelResizeLanes` PLIEGA la pista al bajar del suelo, asi que se acaba con todas plegadas, y
   `fillLanesToViewport` se rinde ahi por decision explicita ("todas plegadas: no hay nada que repartir"). */
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
  for(const l of state.lanes){ l.collapsed=false; l.h=null; } renderTimeline(); return 1; })()`);
await wait(400);
await ev(`window.__mide=function(){ const sc=document.querySelector('#tlscroll'), tl=document.querySelector('.timeline');
  const filas=[...document.querySelectorAll('#tracks .lane')];
  const dib=filas.reduce((s,r)=>s+r.getBoundingClientRect().height,0);
  return { panel:Math.round(tl.getBoundingClientRect().height), muerto:Math.round(tlHueco(sc)-dib),
           plegadas:state.lanes.filter(l=>l.collapsed).length+'/'+state.lanes.length,
           altos:state.lanes.map((l,i)=>laneH(i)).join(','), resizing:_tlResizing }; };
window.__gesto=async function(desde,hasta,pasos){ const h=document.querySelector('#tlResize');
  const tl=document.querySelector('.timeline'); tl.style.height=desde+'px'; _tlAltoManual=true; resize(); renderTimeline(); await new Promise(s=>setTimeout(s,80));
  const r=h.getBoundingClientRect(); const x=r.left+r.width/2, y0=r.top+r.height/2;
  h.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:x,clientY:y0,pointerId:1}));
  const d=hasta-desde;
  for(let k=1;k<=pasos;k++){ window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:x,clientY:y0-Math.round(d*k/pasos),pointerId:1})); await new Promise(s=>setTimeout(s,20)); }
  window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:x,clientY:y0-d,pointerId:1}));
  await new Promise(s=>setTimeout(s,200)); return __mide(); };1`);
console.log('inicio: '+JSON.stringify(await ev(`__mide()`)));
/* Alt+rueda hacia abajo, muchas veces, como haria el usuario */
const chico=await ev(`(async function(){ const tr=document.querySelector('#tracks')||document.querySelector('#tlscroll');
  for(let k=0;k<25;k++){ wheelResizeLanes({deltaY:120, altKey:true, preventDefault(){}}); }
  renderTimeline(); await new Promise(s=>setTimeout(s,200)); return __mide(); })()`);
console.log('tras Alt+rueda hasta el minimo: '+JSON.stringify(chico));
const H=await ev(`Math.round(innerHeight)`);
const grande=await ev(`__gesto(200, ${Math.min(H-120,700)}, 12)`);
console.log('tras SUBIR el contenedor:       '+JSON.stringify(grande));
console.log('\n=> banda muerta: '+grande.muerto+' px'+(grande.muerto>8?'   *** REPRODUCIDO':'   (sin hueco)'));
ws.close();
