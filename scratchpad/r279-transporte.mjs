/* [R279] El transporte, suelto de sus dos ataduras:
     1) se puede reproducir MAS ALLA del ultimo clip (y sin ningun clip);
     2) con un bucle puesto, arrancar FUERA de su tramo reproduce recto, sin teletransportar al bucle;
        arrancar DENTRO sigue envolviendo como siempre. */
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
await wait(1600);

/* ── 1a. PROYECTO VACIO: play desde 0 tiene que avanzar. Es el caso literal de "aunque no haya clips". */
await ev(`(function(){ state.clips=[]; state.workIn=state.workOut=null; state.loop=false; state.playhead=0; renderTimeline(); return 1; })()`);
await ev(`play()`); await wait(1200); const vacio=await ev(`(function(){ const p=state.playhead, on=state.playing; pause(); return {p,on}; })()`);
console.log('1a proyecto VACIO, play desde 0 -> cabezal en '+vacio.p.toFixed(2)+'  (seguia reproduciendo: '+vacio.on+')');
if(vacio.p<0.4) mal('sin clips no avanza: sigue preso de duration()');
if(!vacio.on) mal('se ha detenido solo');

/* ── 1b. MAS ALLA del ultimo clip: un clip corto y el cabezal muy por detras. */
await ev(`(function(){
  const m={id:uid(),name:'x.mp4',kind:'video',w:1920,h:1080,dur:30,fps:30,color:'#8a8',path:'x',folder:null};
  state.media.push(m); renderMedia(); addClip(m,state.lanes[0].id,0);
  state.clips[state.clips.length-1].dur=4;
  state.workIn=state.workOut=null; state.loop=false; state.playing=false;
  state.playhead=20; renderTimeline(); return 1; })()`);
const colocado=await ev(`(function(){ return {ph:state.playhead, dur:duration()}; })()`);
console.log('1b clip hasta 4 s, cabezal puesto en '+colocado.ph+'   duration()='+colocado.dur);
if(colocado.ph<19) mal('no deja ni COLOCAR el cabezal mas alla del ultimo clip: arreglar el play no basta');
await ev(`play()`); await wait(1000); const lejos=await ev(`(function(){ const p=state.playhead,on=state.playing; pause(); return {p,on}; })()`);
console.log('   tras 1 s de play -> '+lejos.p.toFixed(2)+'  (reproduciendo: '+lejos.on+')');
if(lejos.p<colocado.ph+0.4) mal('no avanza mas alla del ultimo clip');
if(!lejos.on) mal('se ha parado al pasar el ultimo clip');

/* ── 2a. BUCLE puesto, arrancar FUERA: debe reproducir recto, sin saltar dentro. */
await ev(`(function(){ state.workIn=2; state.workOut=6; state.loop=true; state.playing=false; state.playhead=40; renderWork(); renderTimeline(); return 1; })()`);
await ev(`play()`); await wait(900); const fuera=await ev(`(function(){ const p=state.playhead,on=state.playing; pause(); return {p,on}; })()`);
console.log('2a bucle 2-6 s, play arrancando en 40 -> '+fuera.p.toFixed(2)+'  (reproduciendo: '+fuera.on+')');
if(fuera.p<39) mal('lo ha teletransportado al bucle: sigue confinando');
if(fuera.p>=39&&fuera.p<40.3) mal('no avanza estando fuera del bucle');

/* ── 2b. y arrancando DENTRO tiene que seguir envolviendo, que es para lo que esta el bucle. */
await ev(`(function(){ state.playhead=5.6; state.playing=false; return 1; })()`);
await ev(`play()`); await wait(1400); const dentro=await ev(`(function(){ const p=state.playhead,on=state.playing; pause(); return {p,on}; })()`);
console.log('2b mismo bucle, play arrancando en 5,6 (dentro) -> '+dentro.p.toFixed(2));
if(!(dentro.p>=1.9&&dentro.p<=6.1)) mal('arrancando DENTRO ya no envuelve: el bucle ha dejado de servir para nada');

console.log('\n'+(fallos?'*** '+fallos+' FALLOS':'el transporte ya no depende de donde acaban los clips, y el bucle solo envuelve si arrancas dentro'));
ws.close();
