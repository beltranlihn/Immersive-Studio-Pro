/* [R250] El mando nuevo: cambiar el tramo del bucle SIN apagarlo y SIN perder la longitud del clip. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await cmd('Page.enable'); await cmd('Page.reload',{ignoreCache:true}); await wait(3800);
console.log(await ev(`(async()=>{
  await newProject('dome',2048,2048,60,180,true); if(typeof hideLanding==='function')hideLanding();
  await new Promise(r=>setTimeout(r,900));
  /* medio de prueba con duracion, sin fichero: basta para la geometria del bucle */
  const cv=document.createElement('canvas'); cv.width=cv.height=64;
  const m={id:uid(),kind:'video',name:'prueba',el:cv,originalEl:cv,tex:newTex(),w:1920,h:1080,dur:50,fps:30,color:'#888',missing:false,_loading:false};
  state.media.push(m); renderMedia();
  const c=makeClip(m,state.lanes.findIndex(l=>l.kind==='video'),0); c.inP=20; c.dur=6.5; state.clips.push(c);
  state.selId=c.id; state.selIds=[c.id];
  toggleLoop(c);
  const A={ loopLen:+c.loopLen.toFixed(2), dur:+c.dur.toFixed(2) };
  c.dur=40; renderTimeline(); renderInspector();
  const filaVisible=!!document.querySelector('#loopLenV');
  const texto=document.querySelector('#loopLenV')?document.querySelector('#loopLenV').textContent:'-';
  /* el boton: tomar el tramo de la longitud ACTUAL del clip, sin apagar nada */
  document.querySelector('#loopFromClip').click();
  const B={ loopLen:+c.loopLen.toFixed(2), dur:+c.dur.toFixed(2), sigueEnBucle:!!c.loop };
  /* y a mano, mas corto que el clip */
  setLoopRange(c,3);
  const C={ loopLen:+c.loopLen.toFixed(2), dur:+c.dur.toFixed(2), aLos10s:+srcT(c,10).toFixed(2), envuelve:[20,23] };
  /* tope: no puede pasarse de lo que queda de fuente */
  setLoopRange(c,999);
  const D={ loopLen:+c.loopLen.toFixed(2), maxPosible:+(m.dur-c.inP).toFixed(2) };
  return { A_alEncender:A, filaVisible, texto, B_delClip:B, C_aMano:C, D_tope:D };
})()`));
ws.close();
