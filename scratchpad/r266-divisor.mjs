/* [R266] El glitch del divisor de la linea de tiempo que grabo Beltran: al agrandar queda un bloque muerto
   debajo de la ultima pista. Se reproduce el gesto DE VERDAD, disparando los eventos de puntero sobre #tlResize,
   con muchas pistas bajitas (el caso del video: empiezan desbordando). */
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

/* 8 pistas, como en el video */
await ev(`(function(){ while(state.lanes.filter(l=>l.kind==='video').length<7) state.lanes.push({id:uid(),name:'V'+(state.lanes.length+1),tag:'V'+(state.lanes.length+1),kind:'video',surf:'wall'});
  for(const l of state.lanes){ l.collapsed=false; l.h=null; } renderTimeline(); return state.lanes.length; })()`);
await wait(400);

/* medida: cuanto sobra entre la ultima pista y el fondo del area visible */
await ev(`window.__mide=function(){ const sc=document.querySelector('#tlscroll'), tl=document.querySelector('.timeline');
  const hueco=tlHueco(sc); let suma=0; state.lanes.forEach((l,i)=>suma+=laneH(i));
  const filas=[...document.querySelectorAll('#tracks .lane')];
  const dibujado=filas.reduce((s,r)=>s+r.getBoundingClientRect().height,0);
  return { panel:Math.round(tl.getBoundingClientRect().height), hueco:Math.round(hueco), sumaLaneH:suma,
           dibujado:Math.round(dibujado), pistas:state.lanes.length,
           muerto:Math.round(hueco-dibujado), scroll:sc.scrollHeight>sc.clientHeight+1 }; };1`);

/* el gesto: pointerdown en el divisor y arrastre hacia ARRIBA (agrandar) en pasos */
await ev(`window.__arrastra=async function(desde,hasta,pasos){
  const h=document.querySelector('#tlResize'); const r=h.getBoundingClientRect();
  const x=r.left+r.width/2, y0=r.top+r.height/2;
  const tl=document.querySelector('.timeline'); tl.style.height=desde+'px'; resize(); renderTimeline(); await new Promise(s=>setTimeout(s,60));
  h.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:x,clientY:y0}));
  const d=(hasta-desde);
  for(let k=1;k<=pasos;k++){ window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:x,clientY:y0-Math.round(d*k/pasos)})); await new Promise(s=>setTimeout(s,20)); }
  window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:x,clientY:y0-d}));
  await new Promise(s=>setTimeout(s,180)); return __mide(); };1`);

const alto=await ev(`Math.round(innerHeight)`);
console.log('ventana: '+alto+' px de alto');
const chico=await ev(`(function(){ const tl=document.querySelector('.timeline'); tl.style.height='220px'; _tlAltoManual=true; resize(); renderTimeline(); return __mide(); })()`);
console.log('\npartida (panel 220, pistas desbordando): '+JSON.stringify(chico));
const grande=await ev(`__arrastra(220, ${Math.min(alto-120, 700)}, 12)`);
console.log('tras arrastrar para AGRANDAR            : '+JSON.stringify(grande));
console.log('\n=> hueco muerto bajo la ultima pista: '+grande.muerto+' px'+(grande.muerto>8?'   *** EL GLITCH':'   (sin hueco)'));

/* y el caso que R244 SI cubre, para contraste: empezar con las pistas cabiendo */
const cabiendo=await ev(`(async function(){ state.lanes.length=0;
  state.lanes.push({id:uid(),name:'V1',tag:'V1',kind:'video',surf:'wall'},{id:uid(),name:'V2',tag:'V2',kind:'video',surf:'wall'});
  renderTimeline(); await new Promise(s=>setTimeout(s,80)); return await __arrastra(300, ${Math.min(alto-120,700)}, 12); })()`);
console.log('\ncontraste — 2 pistas que SI caben al empezar: '+JSON.stringify(cabiendo));
console.log('=> hueco muerto: '+cabiendo.muerto+' px'+(cabiendo.muerto>8?'   *** tambien':'   (correcto: las pistas acompanan)'));
ws.close();
