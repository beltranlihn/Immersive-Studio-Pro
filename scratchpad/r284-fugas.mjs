/* [R284] Los dos hallazgos de CORRECCION del review: que un proyecto nuevo no herede la chapa del anterior,
   y que el visor anuncie la resolucion del MASTER y no la del lienzo en el que se dibuja. */
import http from 'http';
const t=await new Promise((r2,j)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',j);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise((res,rej)=>{const i=++id;p.set(i,r=>r.error?rej(new Error(JSON.stringify(r.error))):(r.result.exceptionDetails?rej(new Error(r.result.exceptionDetails.exception?.description||'')):res(r.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true}}));});
let fallos=0; const mal=m=>{ console.log('   *** '+m); fallos++; };
await ev("(async()=>{ await newProject('dome',4096,4096,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()");
await new Promise(r=>setTimeout(r,1800));
const r=await ev(`(async function(){
  const out={};
  state.slate.obra='Obra vieja'; state.slate.autor='Yo'; state.slate.viewer=true; state.slate.logo='data:image/png;base64,iVBORw0KGgo=';
  /* la resolucion que anuncia la chapa tiene que ser la del MASTER (4096), no la del lienzo del visor (512) */
  /* [R285] chapaDatos ya NO fija la resolucion: alimenta tambien al export, donde la buena es la del fotograma
     que se escribe. Quien la pasa es el VISOR, con el tamano del master. Se comprueba ahi. */
  out.res=(function(){ const d=chapaDatos({resW:state.seqW,resH:state.seqH}); return d.resW+'x'+d.resH; })();
  out.seq=state.seqW+'x'+state.seqH;
  await newProject('dome',2048,2048,30,180,true);
  await new Promise(s=>setTimeout(s,900));
  out.trasNuevo={obra:state.slate.obra,autor:state.slate.autor,viewer:state.slate.viewer,logo:!!state.slate.logo};
  out.resNueva=(function(){ const d=chapaDatos({resW:state.seqW,resH:state.seqH}); return d.resW+'x'+d.resH; })();
  out.exportSinRes=(chapaDatos({}).resW==null);
  out.modo3D=(function(){ const v=state.view.mode; state.view.mode='3d'; const a=chapaVisorVisible(); state.view.mode=v; return a; })();
  return out; })()`);
console.log('proyecto de 4096 -> la chapa anuncia '+r.res+'   (secuencia: '+r.seq+')');
console.log('tras crear uno nuevo de 2048 -> '+JSON.stringify(r.trasNuevo)+'   anuncia '+r.resNueva);
console.log('visible en modo 3D: '+r.modo3D);
if(r.res!=='4096x4096') mal('la chapa no anuncia la resolucion del master: '+r.res);
if(r.trasNuevo.obra||r.trasNuevo.autor||r.trasNuevo.logo||r.trasNuevo.viewer) mal('el proyecto nuevo ha heredado la chapa del anterior');
if(r.resNueva!=='2048x2048') mal('la resolucion no sigue al proyecto nuevo: '+r.resNueva);
if(r.modo3D) mal('la chapa se estampa tambien sobre el visor 3D');
if(!r.exportSinRes) mal('chapaDatos vuelve a fijar la resolucion y hara mentir al export');
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'sin herencia entre proyectos, resolucion del master, y nada en el visor 3D'));
ws.close();
