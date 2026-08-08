/* [R335] Aliasing sobre Nyquist y el INV que se disparaba donde no hay senal.
     1 · El selector de espectro ensenaba hasta 12 kHz con un analisis a 16 kHz, o sea POR ENCIMA DE NYQUIST
         (8 kHz): el tramo alto no ensenaba energia de 12 kHz sino la de ~4 kHz REPLEGADA. Elegir el charles
         daba una senal que reacciona a la caja. El techo baja a Nyquist (subirlo de verdad pide subir SPEC_SR,
         y eso empeora la resolucion de graves: la decision esta escrita en el codigo).
     2 · `fxModLevel` ya devolvia 0 SIN pasar por la inversion cuando no hay banda elegida. Los otros tres «sin
         fuente» -sin cache de bandas, fuera del clip que suena, sin envolvente- se caian a v=0 y seguian hasta
         `fxShape`, que con INV convierte el 0 en 1: el efecto invertido se disparaba al 100 % justo donde no
         hay informacion. 2b es el control: DENTRO del clip, con senal, el INV sigue invirtiendo.

   Uso:  npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r335-verif.mjs
*/
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const p=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const ev=x=>new Promise(r=>{const i=++id;p.set(i,m=>r(m.result&&m.result.exceptionDetails?('EXC '+(m.result.exceptionDetails.exception?.description||'').slice(0,80)):(m.result&&m.result.result&&m.result.result.value)));ws.send(JSON.stringify({id:i,method:'Runtime.evaluate',params:{expression:x,awaitPromise:true,returnByValue:true,timeout:60000}}));});

console.log('');
console.log('R335 - aliasing sobre Nyquist y el INV sin senal');
console.log('');

console.log('1) el selector de espectro no pasa de Nyquist');
const r1 = await ev(`(()=>{ try{
  const nyq=SPEC_SR/2;
  return JSON.stringify({SPEC_SR, SPEC_F1, nyquist:nyq, dentroDeNyquist:SPEC_F1<=nyq,
    graveIntacto:SPEC_F0===40, binHz:+(SPEC_SR/SPEC_FFT).toFixed(2),
    elMapeoRespeta: specF(1e9,100)<=nyq+1 && specF(-1e9,100)>=SPEC_F0-1});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r1);

console.log('2) un efecto invertido NO se dispara donde no hay senal');
const r2 = await ev(`(async()=>{ try{
  await newProject('flat',1920,1080,30,180,true); if(typeof hideLanding==='function')hideLanding();
  const LV=state.lanes.findIndex(l=>l.kind!=='audio');
  _demoAddShape('rect','#888',LV,0,4,{x:0,y:0,scale:100});
  const c=state.clips[state.clips.length-1];
  const fx={id:1,type:'glow',on:true,band:'bass',mode:'follow',int:0,amt:100,atk:8,rel:130,curve:50,spring:0,inv:true};
  _arCache=null; _arTime=1;
  const sinCache=fxModLevel(fx);
  // ahora SI hay cache, con senal alta en la primera mitad del clip
  const env=new Float32Array(90*4); for(let i=0;i<env.length;i++)env[i]=(i<env.length/2)?1:0;
  _arCache={clip:c, fps:90, raw:{bass:env}, bass:env, mid:env, treble:env, bright:env, beats:[], bpm:0, beat0:0};
  _fxEnvCache.clear();
  _arTime=0.5;  const conSenal=fxModLevel(fx);      // dentro del clip, senal alta -> invertido ~0
  _arTime=3.5;  const enSilencio=fxModLevel(fx);    // dentro del clip, senal 0 -> invertido ~1 (correcto)
  _arTime=9;    const fueraDelClip=fxModLevel(fx);  // fuera del clip: NO hay informacion -> 0
  _arCache=null;
  return JSON.stringify({sinCache:+sinCache.toFixed(3), conSenal:+conSenal.toFixed(3),
    enSilencio:+enSilencio.toFixed(3), fueraDelClip:+fueraDelClip.toFixed(3),
    sinCacheEsCero:sinCache===0, fueraEsCero:fueraDelClip===0,
    dentroSigueInvirtiendo: conSenal<0.2 && enSilencio>0.8});
}catch(e){ return 'ERR '+String(e.message).slice(0,90); } })()`); console.log('  ->', r2);

const malas=[];
const J=s=>{ try{ return JSON.parse(s); }catch(e){ return {err:String(s).slice(0,90)}; } };
const o1=J(r1),o2=J(r2);
for(const [n,o] of [['1',o1],['2',o2]]) if(o.err) malas.push('sonda '+n+' rota: '+o.err);
if(!o1.err){ if(!o1.dentroDeNyquist) malas.push('el selector sigue ensenando por encima de Nyquist ('+o1.SPEC_F1+' con '+o1.SPEC_SR+' Hz)');
  if(!o1.graveIntacto) malas.push('se ha movido el suelo del espectro');
  if(!o1.elMapeoRespeta) malas.push('el mapeo del selector no respeta el techo'); }
if(!o2.err){ if(!o2.sinCacheEsCero) malas.push('sin cache de bandas, un efecto invertido devuelve '+o2.sinCache);
  if(!o2.fueraEsCero) malas.push('fuera del clip fuente, un efecto invertido devuelve '+o2.fueraDelClip);
  if(!o2.dentroSigueInvirtiendo) malas.push('dentro del clip el INV ya no invierte: regresion (senal='+o2.conSenal+', silencio='+o2.enSilencio+')'); }
console.log('');
for(const m of malas) console.log('   *** '+m);
console.log(malas.length ? ('*** '+malas.length+' FALLOS') : 'el espectro no miente arriba y el INV no se dispara sin senal');
ws.close(); process.exit(malas.length?1:0);
