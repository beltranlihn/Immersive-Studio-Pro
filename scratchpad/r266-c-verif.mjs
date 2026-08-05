/* [R266] Verificacion del glitch del divisor, por los DOS caminos que lo producen:
   A. el gesto que no termina (soltar fuera de la ventana) -> la bandera se quedaba encendida y el recorte muerto
   B. achicar al minimo y volver a extender -> el acoplamiento se decidia una vez y el panel crecia solo
   Y un tercero de control: el caso que R244 ya cubria, que no debe empeorar. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||r.result.exceptionDetails.text)):res(r.result.result.value)));
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };
await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`);
await wait(1400);
await ev(`(function(){ while(state.lanes.filter(l=>l.kind==='video').length<7) state.lanes.push({id:uid(),name:'V'+(state.lanes.length+1),tag:'V'+(state.lanes.length+1),kind:'video',surf:'wall'});
  for(const l of state.lanes){ l.collapsed=false; l.h=null; } renderTimeline(); return 1; })()`);
await wait(400);
await ev(`window.__mide=function(){ const sc=document.querySelector('#tlscroll'), tl=document.querySelector('.timeline');
  const filas=[...document.querySelectorAll('#tracks .lane')];
  const dib=filas.reduce((s,r)=>s+r.getBoundingClientRect().height,0);
  return { panel:Math.round(tl.getBoundingClientRect().height), muerto:Math.round(tlHueco(sc)-dib), resizing:_tlResizing }; };
window.__gesto=async function(desde,hasta,pasos,soltar){ const h=document.querySelector('#tlResize'); const r=h.getBoundingClientRect();
  const x=r.left+r.width/2, y0=r.top+r.height/2;
  const tl=document.querySelector('.timeline'); tl.style.height=desde+'px'; _tlAltoManual=true; resize(); renderTimeline(); await new Promise(s=>setTimeout(s,80));
  const r2=h.getBoundingClientRect(); const yy=r2.top+r2.height/2;
  h.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:x,clientY:yy,pointerId:1}));
  const d=hasta-desde;
  for(let k=1;k<=pasos;k++){ window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:x,clientY:yy-Math.round(d*k/pasos),pointerId:1})); await new Promise(s=>setTimeout(s,20)); }
  if(soltar==='up') window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:x,clientY:yy-d,pointerId:1}));
  else if(soltar==='cancel') window.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:1}));
  else if(soltar==='blur') window.dispatchEvent(new Event('blur'));
  await new Promise(s=>setTimeout(s,200)); return __mide(); };1`);
const H=await ev(`Math.round(innerHeight)`);

console.log('A · gesto interrumpido: pointercancel (soltar fuera / gesto cancelado)');
const a1=await ev(`__gesto(220, ${Math.min(H-120,700)}, 10, ${JSON.stringify(process.env.MODO||'cancel')})`);
console.log('   tras el gesto: '+JSON.stringify(a1));
const a2=await ev(`(async function(){ for(const l of state.lanes) l.collapsed=true; renderTimeline(); await new Promise(s=>setTimeout(s,220)); return __mide(); })()`);
console.log('   y al plegar las 8 pistas: '+JSON.stringify(a2));
if(a2.resizing) mal('la bandera de arrastre se quedo encendida');
if(a2.muerto>8) mal('queda banda muerta: '+a2.muerto+' px');

console.log('\nB · achicar al minimo y volver a extender');
await ev(`(function(){ for(const l of state.lanes){ l.collapsed=false; l.h=null; } renderTimeline(); return 1; })()`);
await wait(200);
const b1=await ev(`__gesto(600, 170, 10, 'up')`);
console.log('   tras achicar al minimo: '+JSON.stringify(b1));
const b2=await ev(`__gesto(170, ${Math.min(H-120,700)}, 12, 'up')`);
console.log('   tras volver a extender: '+JSON.stringify(b2));
if(b2.muerto>8) mal('al extender queda banda muerta: '+b2.muerto+' px');
if(b2.resizing) mal('la bandera quedo encendida tras extender');

console.log('\nC · control — 2 pistas que SI caben al empezar (lo que R244 ya cubria)');
const c1=await ev(`(async function(){ state.lanes.length=0;
  state.lanes.push({id:uid(),name:'V1',tag:'V1',kind:'video',surf:'wall'},{id:uid(),name:'V2',tag:'V2',kind:'video',surf:'wall'});
  renderTimeline(); await new Promise(s=>setTimeout(s,120)); return await __gesto(300, ${Math.min(H-120,700)}, 12, 'up'); })()`);
console.log('   '+JSON.stringify(c1));
if(c1.muerto>8) mal('el caso que ya funcionaba ahora deja banda muerta');

console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'el divisor, correcto por los tres caminos'));
ws.close();
