/* [R296] El mando de mascara del cuadro de Compose: de 0 a 100, no de 20 a 300. Y que un proyecto guardado con
   un valor antiguo -por encima de 100- se siga viendo igual, que es lo que no hay que romper al estrechar un
   rango. */
import http from 'http';
const t=await new Promise((r2,j)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',j);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||'')):res(r.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };
await ev("(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()");
await new Promise(r=>setTimeout(r,1600));
const r=await ev(`(async function(){
  for(let k=0;k<2;k++) state.media.push({id:uid(),name:'c'+k+'.mp4',kind:'video',w:1920,h:1080,dur:10,fps:30,color:'#888',path:'x'+k,folder:null});
  renderMedia();
  const ids=state.media.filter(m=>m.kind==='video').map(m=>m.id);
  openCompose('ring',{id:9,kind:'ring',mediaIds:ids,mediaId:ids[0],count:6,el:30,size:40,mask:'circle',maskScale:100,rand:[],jitter:0},null,null,null);
  await new Promise(s=>setTimeout(s,600));
  const e=document.querySelector('#cMaskSz');
  const out={min:e.min,max:e.max,val:e.value};
  /* que un valor guardado ANTIGUO siga significando lo mismo */
  out.viejo250=compMaskScale({maskScale:250});
  out.cero=compMaskScale({maskScale:0});
  out.cien=compMaskScale({maskScale:100});
  document.querySelector('#cX')&&document.querySelector('#cX').click();
  return out; })()`);
console.log('mando: de '+r.min+' a '+r.max+'   valor por defecto '+r.val);
console.log('escala con 100 -> '+r.cien+'   con 0 -> '+r.cero+'   con un 250 guardado de antes -> '+r.viejo250);
if(r.min!=='0'||r.max!=='100') mal('el rango sigue mal: '+r.min+'..'+r.max);
if(r.val!=='100') mal('el valor por defecto deberia ser 100');
if(r.cien!==1) mal('100 deberia ser la mascara tal cual');
if(r.cero!==0) mal('0 deberia cerrar la mascara del todo, y da '+r.cero);
if(r.viejo250!==2.5) mal('un proyecto guardado con 250 ha cambiado de aspecto: ahora da '+r.viejo250);
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'el mando va de 0 a 100 y los proyectos antiguos se respetan'));
ws.close(); process.exit(fallos?1:0);
