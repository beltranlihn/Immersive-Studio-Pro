/* [R298b] El reloj del interior de un nido loopeado, visto DESDE DENTRO del paso de dibujado. Se enciende el
   diagnostico, se pide un render en instantes a los dos lados del salto del bucle, y se mira si el reloj que
   ven los modificadores sigue corrido o vuelve atras. */
import http from 'http';
const t=await new Promise((r2,j)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',j);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||'')):res(r.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };
await ev("(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()");
await new Promise(r=>setTimeout(r,2000));
const r=await ev(`(async function(){
  const cv=document.createElement('canvas'); cv.width=cv.height=64; const cx=cv.getContext('2d');
  cx.fillStyle='#C33'; cx.fillRect(0,0,64,64);
  const img={id:uid(),name:'p.png',kind:'image',el:cv,originalEl:cv,tex:newTex(),w:64,h:64,dur:5,fps:0,color:'#C33',folder:null};
  upTex(img.tex,cv); state.media.push(img); renderMedia();
  /* Un nido de 3 s con un elemento que lleva un diente de sierra, como el tejido. */
  const dentro=[{ id:uid(), mediaId:img.id, lane:0, start:0, dur:60, inP:0, props:{x:0,y:0,scale:1}, kf:{},
                  anim:[{id:uid(),param:'x',mode:'saw',speed:0.5,amp:100,phase:0,curve:0,on:true,_lay:1}] }];
  const nido={ id:uid(), kind:'nest', name:'Tejido', dur:3, color:'#679', nestClips:dentro, nestLanes:[{id:1,name:'V1',tag:'V1',kind:'video'}] };
  state.media.push(nido);
  const c={ id:uid(), mediaId:nido.id, lane:state.lanes.findIndex(l=>l.kind==='video'), start:0, dur:12, inP:0, loop:true, loopLen:3, props:{}, kf:{} };
  state.clips.push(c); renderTimeline();
  const muestras=[];
  for(const tt of [2.80,2.95,3.05,3.20,5.95,6.05]){
    _diagNido=[]; state.playhead=tt; render();
    muestras.push({t:tt, dato:_diagNido.length?_diagNido[0]:null});
  }
  _diagNido=null; state.clips=state.clips.filter(x=>x.id!==c.id);
  return muestras; })()`);
let prev=null, ok=true;
for(const m of r){
  if(!m.dato){ console.log('  t='+m.t+'  (el nido no se dibujo)'); ok=false; continue; }
  console.log('  t='+m.t.toFixed(2)+'   tiempo local del nido='+m.dato.lt.toFixed(3)+'   compensacion='+m.dato.comp.toFixed(3)+'   reloj de los modificadores='+m.dato.reloj.toFixed(3));
  if(prev!=null&&m.dato.reloj<prev-0.001) mal('el reloj RETROCEDE de '+prev.toFixed(3)+' a '+m.dato.reloj.toFixed(3)+': ahi esta el reinicio');
  prev=m.dato.reloj;
}
if(!ok) mal('faltan muestras: el nido no llego a dibujarse en algun instante');
console.log('\n'+(fallos?'*** '+fallos+' FALLOS: el reloj del interior se reinicia al loopear':'el reloj del interior sigue corrido; el reinicio esta en otro sitio'));
ws.close(); process.exit(fallos?1:0);
