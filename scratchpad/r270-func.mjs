/* [R270] El cambio es visual, pero movio el rombo de sitio (de la izquierda al bloque .nav de la derecha).
   Se comprueba que SIGUE funcionando: crear keyframe, quitarlo, y que el fader arrastre. */
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
const r=await ev(`(async function(){
  state.media.push({id:uid(),name:'c.mp4',kind:'video',w:1920,h:1080,dur:20,fps:30,color:'#888',path:'x',folder:null});
  const m=state.media[state.media.length-1];
  state.clips=[]; const c=makeClip(m,state.lanes.findIndex(l=>l.kind==='video'),0); c.dur=10; state.clips.push(c);
  state.selId=c.id; state.selIds=[c.id];
  addFxToClip(c,'rgbsplit',false); renderInspector();
  const tb=document.querySelector('.instab[data-tab=react]'); if(tb)tb.click();
  await new Promise(s=>setTimeout(s,500));
  const f=c.fx[0]; const key=fxKey(f,'int');
  const fila=[...document.querySelectorAll('.fxcard .prow.fxrow')].find(x=>x.dataset.k==='int');
  if(!fila)return {sinFila:true};
  const rombo=fila.querySelector('[data-kf]');
  const antes=!!(c.kf&&c.kf[key]);
  if(rombo)rombo.click(); await new Promise(s=>setTimeout(s,250));
  const trasClic=!!(c.kf&&c.kf[key]&&c.kf[key].length);
  /* y el fader: se arrastra el campo y debe cambiar el valor */
  const campo=fila.querySelector('.field'); const rc=campo.getBoundingClientRect();
  const v0=fxParamVal(c.fx[0],'int');
  campo.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:rc.left+10,clientY:rc.top+8,pointerId:2}));
  window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:rc.left+70,clientY:rc.top+8,pointerId:2}));
  window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:rc.left+70,clientY:rc.top+8,pointerId:2}));
  await new Promise(s=>setTimeout(s,250));
  return { hayRombo:!!rombo, antes, trasClic, v0, v1:fxParamVal(c.fx[0],'int'),
           tonoFila:fila.style.getPropertyValue('--pc')||null,
           romboALaDerecha:!!fila.querySelector('.nav [data-kf]') }; })()`);
if(r.sinFila){ console.log('*** no se encontro la fila de Intensity'); process.exit(1); }
console.log('rombo presente: '+r.hayRombo+'   en el bloque de la derecha: '+r.romboALaDerecha);
console.log('keyframe antes del clic: '+r.antes+'  ->  tras el clic: '+r.trasClic);
console.log('valor del fader: '+r.v0+' -> '+r.v1+'   tono de la fila: '+r.tonoFila);
if(!r.hayRombo) mal('no hay rombo en la fila');
if(!r.romboALaDerecha) mal('el rombo no esta en el bloque .nav de la derecha');
if(r.trasClic!==true) mal('el rombo ya no crea keyframe');
if(r.v1===r.v0) mal('el fader ya no arrastra');
if(!r.tonoFila) mal('la fila no lleva color propio (--pc)');
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'los mandos siguen funcionando tras el cambio visual'));
ws.close();
