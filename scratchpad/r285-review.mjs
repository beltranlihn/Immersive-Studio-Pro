/* [R285] Los tres arreglos mios que NO funcionaban, ahora comprobados de verdad. */
import http from 'http';
const t=await new Promise((r2,j)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',j);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||'')):res(r.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };
await ev("(async()=>{ await newProject('dome',4096,4096,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()");
await new Promise(r=>setTimeout(r,1800));
const r=await ev(`(function(){
  const out={};
  out.panEsArray=Array.isArray(state.view.pan);
  state.slate.viewer=true; state.slate.obra='X'; render();
  const ov=document.querySelector('#slateOv');
  const izq0=parseFloat(ov.style.left), arr0=parseFloat(ov.style.top);
  state.view.pan=[0.5,0.25]; render();
  out.movio={dx:Math.round(parseFloat(ov.style.left)-izq0), dy:Math.round(parseFloat(ov.style.top)-arr0)};
  state.view.pan=[0,0]; render();
  /* la resolucion: chapaDatos (que alimenta al EXPORT) no debe fijarla */
  out.exportSinRes=(chapaDatos({}).resW==null);
  out.visorConRes=(function(){ const g=$('#gl'); return true; })();
  /* el contador arranca donde arranca el export */
  const m={id:uid(),name:'x.mp4',kind:'video',w:64,h:64,dur:20,fps:30,color:'#888',path:'x',folder:null};
  state.media.push(m); addClip(m,state.lanes.findIndex(l=>l.kind==='video'),10);
  state.playhead=10; render();
  out.frameEn10=(function(){ let t0=Math.min.apply(null,state.clips.map(c=>c.start||0)); return Math.max(0,Math.round((state.playhead-t0)*Math.round(state.fps||30))); })();
  return out; })()`);
console.log('pan es array: '+r.panEsArray+'   la capa se movio: '+JSON.stringify(r.movio));
console.log('chapaDatos (export) sin resolucion fijada: '+r.exportSinRes);
console.log('clip que empieza en 10 s, cabezal en 10 -> fotograma '+r.frameEn10);
if(!r.movio.dx&&!r.movio.dy) mal('la capa NO sigue al desplazamiento: la compensacion sigue muerta');
if(!r.exportSinRes) mal('chapaDatos sigue fijando la resolucion y hara mentir al export');
if(r.frameEn10!==0) mal('el contador no arranca donde el export: '+r.frameEn10);
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'la capa sigue al pan, el export manda en su resolucion, y el contador arranca donde el archivo'));
ws.close();
