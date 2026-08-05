/* [R263b] Los cuatro hallazgos del code review:
     1. la vista previa del tunel leia `g.fade`, que ya no existe -> apagar el fundido no cambiaba nada EN PANTALLA
     2. cambiar un TEJIDO a TUNEL dejaba el nido en plano -> esparcido rectangular en vez de tunel
     3. al cambiar de tipo, el movimiento del tipo anterior se quedaba pegado a los clips reutilizados
     4. el campo Ancho del inspector llegaba a 200 y el motor topa en 100 */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||r.result.exceptionDetails.text)):res(r.result.result.value)));
  ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };
await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`);
await new Promise(r=>setTimeout(r,1200));

/* 1 · la vista previa tiene que RESPONDER al fundido: se dibuja con y sin, y se comparan los pixeles */
const prev=await ev(`(function(){
  const base={kind:'tunnel',mediaIds:[],mediaId:null,count:8,sizeFrom:1,sizeTo:200,speed:0.12,curve:60,mask:'none',rand:[],jitter:0};
  const cv=document.createElement('canvas'); cv.width=cv.height=150;
  const pinta=(g)=>{ const c=cv.getContext('2d'); c.clearRect(0,0,150,150); drawComposePreview(g,cv);
    const d=c.getImageData(0,0,150,150).data; let s=0; for(let i=3;i<d.length;i+=4)s+=d[i]; return s; };
  return { conFundido:pinta({...base}), sinFundido:pinta({...base,fadeIn:0,fadeOut:0}),
           soloEntrada:pinta({...base,fadeIn:0.2,fadeOut:0}) }; })()`);
console.log('1 · vista previa del tunel (suma de alfa dibujada):');
console.log('   con fundido '+prev.conFundido+' · sin fundido '+prev.sinFundido+' · solo entrada '+prev.soloEntrada);
if(prev.conFundido===prev.sinFundido) mal('la vista previa NO cambia al apagar el fundido');
if(prev.sinFundido<=prev.conFundido) mal('sin fundido deberia dibujarse mas opaco, no menos');
if(prev.soloEntrada===prev.conFundido||prev.soloEntrada===prev.sinFundido) mal('la vista previa no distingue entrada sola');

/* 2 y 3 · tejido -> tunel: modo del nido y movimiento heredado */
const cam=await ev(`(function(){
  state.media=state.media.filter(m=>m.kind!=='nest');
  const src={id:uid(),name:'f.mp4',kind:'video',w:1920,h:1080,dur:10,fps:30,color:'#888',path:'x',folder:null};
  state.media.push(src);
  const n={id:uid(),name:'tejido',kind:'nest',w:1024,h:1024,mode:'flat',dur:5,fps:30,color:'#888',nestClips:[],nestLanes:[],
    comp:{id:uid(),kind:'weave',mediaIds:[src.id],mediaId:src.id,count:6,bands:5,bandW:100,density:1,weaveMode:'weave',
          fit:'across',motion:'alternate',speedV:0.12,speed:0.12,interlace:true,size:40,el:30,cols:3,arc:140,mask:'none',rand:[],jitter:0}};
  state.media.push(n); regenComposeNest(n);
  const antes={ modo:n.mode, clips:n.nestClips.length, mods:n.nestClips[0]?n.nestClips[0].anim.length:0,
                params:n.nestClips[0]?n.nestClips[0].anim.map(a=>a.param+'/'+a.mode).join(','):'' };
  /* el usuario anade SU propio movimiento a mano */
  if(n.nestClips[0]) n.nestClips[0].anim.push({id:uid(),param:'rot',mode:'linear',speed:5,amp:0,phase:0,on:true});
  /* y ahora cambia el tipo a tunel, como haria desde el inspector */
  n.comp.kind='tunnel'; ensureRand(n.comp); regenComposeNest(n);
  const desp={ modo:n.mode, clips:n.nestClips.length, mods:n.nestClips[0]?n.nestClips[0].anim.length:0,
               params:n.nestClips[0]?n.nestClips[0].anim.map(a=>a.param+'/'+a.mode).join(','):'',
               mio:n.nestClips[0]?n.nestClips[0].anim.some(a=>a.param==='rot'&&!a._lay):false };
  return {antes,desp}; })()`);
console.log('\n2 y 3 · un TEJIDO cambiado a TUNEL:');
console.log('   antes:   nido '+cam.antes.modo+' · '+cam.antes.clips+' clips · movimiento: '+cam.antes.params);
console.log('   despues: nido '+cam.desp.modo+' · '+cam.desp.clips+' clips · movimiento: '+cam.desp.params);
if(cam.desp.modo!=='dome') mal('el nido sigue en «'+cam.desp.modo+'»: el tunel se repartiria como plano');
if(/x\/saw|y\/saw/.test(cam.desp.params)) mal('sigue pegado el movimiento del tejido');
if(!/size\/saw/.test(cam.desp.params)) mal('falta el diente de sierra del tunel');
if(!cam.desp.mio) mal('se ha perdido el movimiento que anadio el usuario a mano');

/* 4 · el campo Ancho del inspector */
const anc=await ev(`(function(){
  const n=state.media.find(m=>m.kind==='nest'); n.comp.kind='weave'; regenComposeNest(n);
  state.clips=[]; const c=makeClip(n,state.lanes.findIndex(l=>l.kind==='video'),0); c.dur=5; state.clips.push(c);
  state.selId=c.id; state.selIds=[c.id]; renderInspector();
  const el=document.querySelector('#icWW'); return el?{min:el.min,max:el.max}:null; })()`);
console.log('\n4 · campo «Ancho» del inspector: ' + JSON.stringify(anc));
if(!anc) mal('no aparece el campo Ancho con un tejido seleccionado');
else if(+anc.max!==100) mal('el tope sigue en '+anc.max+', y el motor topa en 100');

console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'los cuatro hallazgos, corregidos'));
ws.close();
