/* [R353] El cache de un nido no sabe de bucles: un compose loopeado reiniciaba el movimiento y parpadeaba. */
import http from 'http';
const t=await new Promise((r2,rj)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',rj);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:120000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await ev(`window.__errs=[];addEventListener('error',e=>__errs.push(String(e.message||e)));
 const ce=console.error;console.error=function(){try{__errs.push('con: '+[...arguments].map(String).join(' '));}catch(_){}return ce.apply(console,arguments);};1`);
await ev(`(async()=>{try{await startDemoProject('dome');}catch(e){}})()`); await wait(2600);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){} return 1;})()`); await wait(600);
console.log(JSON.stringify(await ev(`(function(){
  const src=state.media.find(m=>m.kind!=='audio'&&!isSeqMedia(m)); if(!src)return {saltado:'sin medio'};
  // fabrica un nido cuadrado con CACHE fingido listo, para que ncUsable(m) sea cierto
  const nido=(conReloj)=>{ const n=newSeqMedia(conReloj?'ConReloj':'SinReloj',state.fps,1024,1024,null,null,'dome',180);
    const inner=makeClip(src,0,0,{az:0,el:45,size:60},{name:'x'}); inner.dur=4; inner.lane=0;
    if(conReloj)inner.anim=[{k:'saw',p:'az',amt:360,speed:0.25}];
    n.nestClips=[inner]; n.nestLanes=[{id:uid(),name:'V1',tag:'V1',kind:'video'}]; n.dur=4;
    n.ncReady=true; n.ncUrl='file:///fingido.mp4'; n.ncStale=false;    // cache "listo"
    state.media.push(n); return n; };
  const clip=(n,loop)=>{ const c=makeClip(n,0,0,{},{name:'c'}); c.dur=8; c.lane=0;
    if(loop){ c.loop=true; c.loopLen=2; c.inP=0; } return c; };
  const A=nido(true),  B=nido(false);
  const cA=clip(A,true), cA2=clip(A,false), cB=clip(B,true);
  const r={
    detector:{ conReloj:nestConReloj(A), sinReloj:nestConReloj(B) },
    cacheDisponible:{ A:ncUsable(A), B:ncUsable(B) },
    decision:{
      loopConReloj:  ncUsableFor(cA ,A),   // <- el caso roto: NO debe usar cache
      sinLoopConReloj:ncUsableFor(cA2,A),  // <- sin bucle, el cache vale
      loopSinReloj:  ncUsableFor(cB ,B) }, // <- bucle sin movimiento: repite identico, cache vale
    // LA RED SABE FALLAR: con la logica ANTERIOR (solo ncUsable) el caso roto daba "usar cache"
    conLaLogicaVieja:{ loopConReloj: ncUsable(A) },
  };
  // los TRES puntos de decision tienen que coincidir para el mismo clip
  const puntos=(c,m)=>({ prepNests:ncUsableFor(c,m), vinst:!!vinstEnsure(c,m), drawn:(m.kind==='nest'&&ncUsableFor(c,m)) });
  r.tresPuntosCoinciden_loopConReloj=(()=>{ const q=puntos(cA,A); return q.prepNests===q.vinst && q.vinst===q.drawn; })();
  r.tresPuntos_loopConReloj=puntos(cA,A);
  // y el reloj que se compone en vivo NO reinicia
  state.clips=[cA]; state.lanes=[{id:uid(),name:'V1',tag:'V1',kind:'video'}]; cA.lane=0;
  const relojes=[]; for(let i=0;i<=8;i++){ const T=i; const lt=srcT(cA,T);
    const sin=(cA.inP||0)+(T-cA.start)*(cA.speed||1); relojes.push({t:T, envuelto:+lt.toFixed(2), recompuesto:+sin.toFixed(2)}); }
  r.relojes=relojes; r.elRecompuestoNoReinicia=relojes.every((x,i)=>i===0||x.recompuesto>relojes[i-1].recompuesto);
  state.media=state.media.filter(m=>m.id!==A.id&&m.id!==B.id);
  return r; })()`),null,1));
console.log('videoNormal:', JSON.stringify(await ev(`(function(){
  const v=state.media.find(m=>m.kind==='video'); if(!v)return {saltado:'sin video'};
  const c=makeClip(v,0,0,{},{}); c.dur=5;
  let err=null, vi=null; try{ vi=vinstEnsure(c,v); }catch(e){ err=String(e&&e.message||e); }
  return { lanzaExcepcion:!!err, error:err, devuelveInstancia:!!vi }; })()`)));
console.log('errs:', JSON.stringify(await ev(`__errs.slice(0,10)`)));
ws.close();

/* [R353b] La sonda de R353 SOLO ejercitaba la rama de nido, y por eso no vio que un comentario `//` mal
   colocado se habia tragado `const url=_vinstUrl(m)` en vinstEnsure: con un clip de VIDEO normal la funcion
   lanzaba ReferenceError y se caia la reproduccion entera. Cubrir el camino comun, no solo el que se toca. */
