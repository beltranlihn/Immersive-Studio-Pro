/* [R271] Tanda corta de la lista: 6 (flechita del bucle), 8 (parametros por tipo en el inspector),
   14 (fotograma a fotograma en el monitor) y 15 (fantasma del arrastre). */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||r.result.exceptionDetails.text)):res(r.result.result.value)));
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };
const VID='C:/Users/beltr/Desktop/Alma Digital Studio/Code/Alma Digital Portfolio/Asset/Reel Portfolio/Reel Portfolio.mp4';
await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`);
await wait(1400);
await ev(`window.__vid=function(ruta,nombre){ return new Promise(res=>{ const url=DSP.toFileURL(ruta); const v=document.createElement("video"); v.preload="metadata"; v.src=url;
  v.addEventListener("loadedmetadata",()=>{ const m={id:uid(),name:nombre,kind:"video",el:v,originalEl:v,srcUrl:url,tex:newTex(),w:v.videoWidth,h:v.videoHeight,dur:v.duration,fps:30,color:'#7A9E7E',proxyReady:false,proxyPct:0,path:ruta,fsize:0,folder:null,missing:false,_loading:false};
    state.media.push(m); renderMedia(); res(m.id); }); v.addEventListener("error",()=>res(null)); }); };1`);
const mid=await ev(`__vid(${JSON.stringify(VID)},"reel.mp4")`);

/* 6 · la flechita */
const seis=await ev(`(function(){ const m=mediaById(${JSON.stringify(mid)});
  state.clips=[]; const c=makeClip(m,state.lanes.findIndex(l=>l.kind==='video'),0); c.dur=20; state.clips.push(c);
  state.selId=c.id; state.selIds=[c.id]; toggleLoop(c); setLoopRange(c,4); c.dur=20; renderTimeline();
  const cd=document.querySelector('#tracks .clip'); const txt=cd?cd.textContent:'';
  const puntos=cd?cd.querySelectorAll('div[style*="repeating-linear-gradient"]').length:0;
  return { flechitas:(txt.match(/\u21bb/g)||[]).length, lineasPunteadas:puntos, titulo:cd?cd.querySelector('.tt').textContent:'' }; })()`);
console.log('6 · flechitas en el clip: '+seis.flechitas+'   lineas punteadas de bucle: '+seis.lineasPunteadas+'   titulo: "'+seis.titulo+'"');
if(seis.flechitas!==0) mal('sigue habiendo flechitas de bucle');
if(seis.lineasPunteadas<3) mal('han desaparecido las lineas punteadas (quedan '+seis.lineasPunteadas+')');

/* 8 · parametros del inspector por tipo de compose */
const ocho=await ev(`(function(){ const res={};
  for(const kind of ['tunnel','weave','ring']){
    state.media=state.media.filter(x=>x.kind!=='nest');
    const n={id:uid(),name:'n',kind:'nest',w:1024,h:1024,mode:kind==='weave'?'flat':'dome',dur:5,fps:30,color:'#888',nestClips:[],nestLanes:[],
      comp:{id:uid(),kind,mediaIds:[],mediaId:null,count:6,el:30,size:40,cols:3,arc:140,sizeTo:180,bands:5,bandW:100,mask:'none',rand:[],jitter:0}};
    state.media.push(n); state.clips=[]; const c=makeClip(n,state.lanes.findIndex(l=>l.kind==='video'),0); c.dur=5; state.clips.push(c);
    state.selId=c.id; state.selIds=[c.id]; renderInspector();
    const seg=document.querySelector('#icKind'); const on=seg?[...seg.querySelectorAll('button.on')].map(b=>b.dataset.k):[];
    res[kind]={ marcado:on.join(','), campos:[...document.querySelectorAll('#tfRows input[data-key]')].map(i=>i.dataset.key) };
  } return res; })()`);
console.log('\n8 · parametros por tipo:');
for(const [k,v] of Object.entries(ocho)){ console.log('   '+k.padEnd(7)+'marcado: '+(v.marcado||'NINGUNO')+'   campos: '+v.campos.join(', '));
  if(v.marcado!==k) mal(k+': su tipo no queda marcado en el inspector'); }
if(ocho.tunnel.campos.includes('el')||ocho.tunnel.campos.includes('size')) mal('el tunel sigue ofreciendo Elevacion/Tamano, que no le aplican');
if(ocho.weave.campos.includes('size')) mal('el tejido sigue ofreciendo Tamano');

/* 14 y 15 · monitor de origen */
const mon=await ev(`(async function(){ const m=mediaById(${JSON.stringify(mid)});
  openSourceMonitor(m); await new Promise(s=>setTimeout(s,600));
  const el=document.querySelector('#srcMon'); el.focus();
  const t0=_srcMon.t;
  const tecla=(k,sh)=>window.dispatchEvent(new KeyboardEvent('keydown',{key:k,code:k,bubbles:true,shiftKey:!!sh}));
  tecla('ArrowRight'); await new Promise(s=>setTimeout(s,120)); const t1=_srcMon.t;
  tecla('ArrowRight'); await new Promise(s=>setTimeout(s,120)); const t2=_srcMon.t;
  tecla('ArrowLeft');  await new Promise(s=>setTimeout(s,120)); const t3=_srcMon.t;
  tecla('ArrowRight',true); await new Promise(s=>setTimeout(s,120)); const t4=_srcMon.t;
  /* el fantasma del arrastre */
  const pic=_srcMon.pic; const r=pic.getBoundingClientRect();
  pic.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.left+40,clientY:r.top+40,pointerId:3}));
  window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:r.left+80,clientY:r.top+80,pointerId:3}));
  await new Promise(s=>setTimeout(s,150));
  const g=[...document.body.children].reverse().find(x=>x.style&&x.style.position==='fixed'&&x.style.pointerEvents==='none');
  const gr=g?g.getBoundingClientRect():null;
  window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:r.left+80,clientY:r.top+80,pointerId:3}));
  const areaPic=r.width*r.height;
  try{ closeSourceMonitor(); }catch(e){}
  return { fps:m.fps, t0,t1,t2,t3,t4, fantasma: gr?{w:Math.round(gr.width),h:Math.round(gr.height)}:null,
           areaImagen:Math.round(areaPic) }; })()`);
const paso=1/(mon.fps||30);
console.log('\n14 · flechas en el monitor (fps '+mon.fps+', un fotograma = '+paso.toFixed(4)+' s):');
console.log('   '+[mon.t0,mon.t1,mon.t2,mon.t3,mon.t4].map(v=>(+v).toFixed(4)).join(' -> '));
if(Math.abs((mon.t1-mon.t0)-paso)>1e-3) mal('la flecha derecha no avanza un fotograma');
if(Math.abs((mon.t2-mon.t1)-paso)>1e-3) mal('la segunda flecha no avanza otro fotograma');
if(Math.abs((mon.t3-mon.t2)+paso)>1e-3) mal('la flecha izquierda no retrocede un fotograma');
if(Math.abs((mon.t4-mon.t3)-1)>1e-3) mal('shift+flecha no salta un segundo');
console.log('\n15 · fantasma del arrastre: '+JSON.stringify(mon.fantasma)+'   (el area de imagen mide '+mon.areaImagen+' px2)');
if(!mon.fantasma) mal('no se pudo medir el fantasma');
else if(mon.fantasma.h>120) mal('el fantasma sigue siendo una ventana grande ('+mon.fantasma.h+' px de alto)');
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'los cuatro puntos de la tanda, correctos'));
ws.close();
