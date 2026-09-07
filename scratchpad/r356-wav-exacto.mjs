/* [R356] El lector de WAV en flujo tiene que dar EXACTAMENTE lo mismo que decodeAudioData. */
import http from 'http';
const t=await new Promise((r2,rj)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',rj);});
const ws=new WebSocket(t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl).webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async(x,ms=180000)=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:ms});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const DIR='/private/tmp/claude-501/-Users-vicentemanzano-Desktop-Immersive-Studio-Pro/3cfceee5-d8c2-4775-bd7f-c99aa482a586/scratchpad/wavs';
for(const f of ['p24.wav','p16.wav','p32f.wav']){
  console.log(f, JSON.stringify(await ev(`(async function(){
    const url=DSP.toFileURL(${JSON.stringify(DIR)}+'/'+${JSON.stringify(f)});
    let a=null, seCayoAlNormal=false;
    try{ a=await decodificarWavEnFlujo(url); }
    catch(e){ seCayoAlNormal=true; }
    if(seCayoAlNormal) return { seCayoAlCaminoDeSiempre:true, motivo:'muestreo distinto del contexto (correcto)' };
    const bb=await (await fetch(url)).arrayBuffer();
    const b=await new Promise((ok,mal)=>{const pr=ACTX().decodeAudioData(bb,ok,mal); if(pr&&pr.catch)pr.catch(()=>{});});
    const r={ seCayoAlCaminoDeSiempre:false, canales:[a.numberOfChannels,b.numberOfChannels], muestreo:[a.sampleRate,b.sampleRate], marcos:[a.length,b.length] };
    if(a.numberOfChannels!==b.numberOfChannels||a.length!==b.length){ r.iguales=false; return r; }
    let peor=0;
    for(let c=0;c<a.numberOfChannels;c++){ const x=a.getChannelData(c), y=b.getChannelData(c);
      for(let i=0;i<x.length;i++){ const d=Math.abs(x[i]-y[i]); if(d>peor)peor=d; } }
    r.peorDiferencia=+peor.toExponential(2); r.iguales=peor<1e-6; return r; })()`)));
}
/* LA RED SABE FALLAR: con el conversor equivocado (24 bits leidos como 16) la diferencia tiene que dispararse */
console.log('control (conversor roto a proposito):', JSON.stringify(await ev(`(async function(){
  const url=DSP.toFileURL(${JSON.stringify(DIR)}+'/p24.wav');
  const orig=_conversorPcm; window._conversorPcm=function(fmt){ return {ancho:3, leer:(dv,o)=>dv.getInt16(o,true)/32768}; };
  let peor=0;
  try{ const a=await decodificarWavEnFlujo(url);
    const bb=await (await fetch(url)).arrayBuffer();
    const b=await new Promise((ok,mal)=>{const pr=ACTX().decodeAudioData(bb,ok,mal); if(pr&&pr.catch)pr.catch(()=>{});});
    const x=a.getChannelData(0), y=b.getChannelData(0);
    for(let i=0;i<x.length;i++){ const d=Math.abs(x[i]-y[i]); if(d>peor)peor=d; }
  } finally { window._conversorPcm=orig; }
  return { peorDiferencia:+peor.toExponential(2), laSondaLoCaza:peor>1e-3 }; })()`)));
process.exit(0);
