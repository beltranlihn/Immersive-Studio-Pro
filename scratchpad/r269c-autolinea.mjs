/* [R269] Punto 2: anadir un punto sobre la linea de automatizacion NO debe cambiar el valor.
   Se simula el clic a distintas alturas dentro de la tolerancia de 8 px y se comprueba que el punto nace con el
   valor de la LINEA (el real del efecto), no con el del raton. */
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

/* un clip con opacidad 70 y SIN automatizar: la linea debe valer 70 en todo el clip */
const prep=await ev(`(function(){
  state.media.push({id:uid(),name:'f.mp4',kind:'video',w:1920,h:1080,dur:20,fps:30,color:'#888',path:'x',folder:null});
  const m=state.media[state.media.length-1];
  state.clips=[]; const c=makeClip(m,state.lanes.findIndex(l=>l.kind==='video'),0); c.dur=10; c.props.opacity=70; state.clips.push(c);
  state.selId=c.id; state.selIds=[c.id]; state.inlineCurves=true;
  const li=c.lane; state.lanes[li]._autoP='opacity';
  renderTimeline(); return { opacidad:c.props.opacity, valorDeLaLinea:evalP(c,'opacity',c.start+3) }; })()`);
await wait(600);
console.log('clip con opacidad '+prep.opacidad+' sin automatizar · la linea vale '+prep.valorDeLaLinea+' en t=3s');

/* clic sobre el lienzo de automatizacion, a varias alturas dentro de la tolerancia */
const r=await ev(`(async function(){
  const cv=document.querySelector('#tracks canvas.clipautocv'); if(!cv)return {sinLienzo:true};
  const c=state.clips[0]; const out=[];
  for(const desvio of [0,-4,4,-12]){
    if(c.kf)delete c.kf['opacity'];
    const m=cv._map; const rect=cv.getBoundingClientRect();
    const tRel=3, lv=evalP(c,'opacity',c.start+tRel);
    const x=rect.left+((c.start+tRel)*m.pps-(m.ox||0));
    const y=rect.top+m.padT+(1-(lv-m.mn)/((m.mx-m.mn)||1))*m.gh+desvio;
    cv.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:x,clientY:y,pointerId:1}));
    window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0,clientX:x,clientY:y,pointerId:1}));
    await new Promise(s=>setTimeout(s,120));
    const ks=(c.kf&&c.kf['opacity'])||[];
    out.push({ desvioPx:desvio, puntos:ks.length, valor:ks.length?+ks[0].v.toFixed(2):null, esperado:lv });
  }
  if(c.kf)delete c.kf['opacity'];
  return {out}; })()`);
if(r.sinLienzo){ console.log('*** no hay lienzo de automatizacion (no se pudo probar)'); process.exit(1); }
console.log('\nclic sobre la linea, a distintas alturas dentro de la tolerancia:');
for(const o of r.out){
  console.log('   desvio '+String(o.desvioPx).padStart(3)+' px -> puntos: '+o.puntos+'   valor del punto: '+o.valor+'   (la linea vale '+o.esperado+')');
  /* fuera de la tolerancia (6 px) el clic va al FONDO y no anade punto: es lo correcto, no un fallo */
  if(Math.abs(o.desvioPx)>6){ if(o.puntos!==0) mal('desvio '+o.desvioPx+' px: esta fuera de la linea y no deberia anadir punto'); continue; }
  if(o.puntos!==1){ mal('desvio '+o.desvioPx+': deberia haber creado UN punto'); continue; }
  if(Math.abs(o.valor-o.esperado)>0.01) mal('desvio '+o.desvioPx+' px: el punto nace con '+o.valor+' en vez de '+o.esperado+' — salta el valor');
}
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'anadir un punto sobre la linea no cambia el valor'));
ws.close();
