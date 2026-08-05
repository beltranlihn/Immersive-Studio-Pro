/* [R274] Puntos 9 (separacion del tunel) y 5 (dos reactivos nuevos: pulso de escala y rotacion). */
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

/* 9 · mas anillos = mas juntos, MISMA velocidad */
const nueve=await ev(`(function(){
  const base={kind:'tunnel',mediaIds:[],mediaId:null,sizeFrom:1,sizeTo:200,speed:0.12,curve:0,twist:0,helix:0,mask:'none',rand:[],jitter:0};
  const fases=(n)=>compLayout({...base,count:n}).map(p=>+(p._phase||0).toFixed(4));
  const a=fases(6), b=fases(24), c=fases(96);
  const paso=x=>+(x[1]-x[0]).toFixed(4);
  const cicloSeg=1/0.12;
  return { n6:a.length, n24:b.length, n96:c.length, paso6:paso(a), paso24:paso(b), paso96:paso(c),
           topeTunel:compCountMax('tunnel'), topeAnillo:compCountMax('ring'),
           nacimientos6:+(1/(paso(a)*cicloSeg)).toFixed(2), nacimientos96:+(1/(paso(c)*cicloSeg)).toFixed(2) }; })()`);
console.log('9 · el tunel admite hasta '+nueve.topeTunel+' anillos (los demas tipos siguen en '+nueve.topeAnillo+')');
console.log('   con 6 anillos : paso entre ellos '+nueve.paso6+' del ciclo -> '+nueve.nacimientos6+' nacimientos/s');
console.log('   con 96 anillos: paso entre ellos '+nueve.paso96+' del ciclo -> '+nueve.nacimientos96+' nacimientos/s');
if(nueve.n96!==96) mal('no se reparten 96 anillos (salen '+nueve.n96+')');
if(nueve.topeTunel<=32) mal('el tope del tunel sigue en '+nueve.topeTunel);
if(nueve.topeAnillo!==32) mal('se ha cambiado el tope de los demas tipos');
if(!(nueve.paso96<nueve.paso6)) mal('con mas anillos no van mas juntos');

/* 5 · los dos reactivos nuevos */
const cinco=await ev(`(function(){
  const hay=['pulsescale','pulserot'].map(k=>({k, existe:!!FXBY[k], params:FXBY[k]?FXBY[k].params.map(p=>p.k):null}));
  state.media.push({id:uid(),name:'c.mp4',kind:'video',w:1920,h:1080,dur:10,fps:30,color:'#888',path:'x',folder:null});
  const m=state.media[state.media.length-1];
  state.clips=[]; const c=makeClip(m,state.lanes.findIndex(l=>l.kind==='video'),0); c.dur=5; state.clips.push(c);
  state.selId=c.id; state.selIds=[c.id];
  let err=null;
  try{ addFxToClip(c,'pulsescale',false); addFxToClip(c,'pulserot',false);
       render(); /* si el shader no compila, aqui salta */ }catch(e){ err=String(e.message||e); }
  const gl2=gl; const glErr=gl2.getError();
  return { hay, err, glErr, fx:c.fx.map(f=>f.type) }; })()`);
console.log('\n5 · reactivos nuevos:');
for(const h of cinco.hay) console.log('   '+h.k.padEnd(12)+'registrado: '+h.existe+'   parametros: '+(h.params||[]).join(', '));
console.log('   aplicados al clip: '+cinco.fx.join(', ')+'   error: '+(cinco.err||'ninguno')+'   glGetError: '+cinco.glErr);
for(const h of cinco.hay) if(!h.existe) mal(h.k+' no esta registrado');
if(cinco.err) mal('fallo al aplicarlos/renderizar: '+cinco.err);
if(cinco.glErr!==0) mal('WebGL devuelve error '+cinco.glErr+' (probablemente el shader no compila)');
console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'separacion del tunel y reactivos nuevos, correctos'));
ws.close();
