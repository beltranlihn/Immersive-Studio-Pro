/* [R267] Los dos casos limite del despliegue automatico:
   A. ACHICAR despues de haber crecido no debe re-plegar ni dejar hueco.
   B. Si el usuario dejo ALGUNAS plegadas a mano, esas siguen plegadas y el reparto va a las demas. */
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
  return { panel:Math.round(tl.getBoundingClientRect().height), muerto:Math.round(tlHueco(sc)-dib),
           plegadas:state.lanes.filter(l=>l.collapsed).length, altos:state.lanes.map((l,i)=>laneH(i)).join(',') }; };
window.__gesto=async function(desde,hasta,pasos){ const h=document.querySelector('#tlResize');
  const tl=document.querySelector('.timeline'); tl.style.height=desde+'px'; _tlAltoManual=true; resize(); renderTimeline(); await new Promise(s=>setTimeout(s,80));
  const r=h.getBoundingClientRect(); const x=r.left+r.width/2, y0=r.top+r.height/2;
  h.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:x,clientY:y0,pointerId:1}));
  const d=hasta-desde;
  for(let k=1;k<=pasos;k++){ window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:x,clientY:y0-Math.round(d*k/pasos),pointerId:1})); await new Promise(s=>setTimeout(s,20)); }
  window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:x,clientY:y0-d,pointerId:1}));
  await new Promise(s=>setTimeout(s,200)); return __mide(); };1`);
const H=await ev(`Math.round(innerHeight)`);
console.log('A · plegar todas, crecer, y volver a ACHICAR');
await ev(`(function(){ for(let k=0;k<25;k++) wheelResizeLanes({deltaY:120,altKey:true,preventDefault(){}}); renderTimeline(); return 1; })()`);
const a1=await ev(`__gesto(233, ${Math.min(H-120,700)}, 12)`);
console.log('   crecido : '+JSON.stringify(a1));
const a2=await ev(`__gesto(${Math.min(H-120,700)}, 260, 12)`);
console.log('   achicado: '+JSON.stringify(a2));
if(a2.muerto>8) mal('al achicar queda hueco');
if(a2.plegadas>0) mal('achicar el contenedor ha vuelto a plegar pistas');

console.log('\nB · con 3 pistas plegadas A MANO, crecer no debe desplegarlas');
const b=await ev(`(async function(){ for(const l of state.lanes){ l.collapsed=false; l.h=null; }
  state.lanes[0].collapsed=true; state.lanes[1].collapsed=true; state.lanes[2].collapsed=true;
  renderTimeline(); await new Promise(s=>setTimeout(s,150));
  return await __gesto(300, ${Math.min(H-120,700)}, 12); })()`);
console.log('   '+JSON.stringify(b));
if(b.plegadas!==3) mal('las plegadas a mano no se han respetado (quedan '+b.plegadas+' de 3)');
if(b.muerto>8) mal('queda hueco: '+b.muerto+' px');
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'los dos limites, correctos'));
ws.close();
