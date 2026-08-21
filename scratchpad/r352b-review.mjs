/* [R352b] Verificacion de los hallazgos de las dos revisiones de R303->R352. */
import http from 'http';
const t=await new Promise((r2,rj)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',rj);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:90000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await ev(`window.__errs=[];addEventListener('error',e=>__errs.push(String(e.message||e)));
 const ce=console.error;console.error=function(){try{__errs.push('con: '+[...arguments].map(String).join(' '));}catch(_){}return ce.apply(console,arguments);};1`);
await ev(`(async()=>{try{await startDemoProject('dome');}catch(e){}})()`); await wait(2600);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){} return 1;})()`); await wait(600);
const out={};

/* D1 · un clic sobre el tirador de recorte NO puede cortar al vecino */
out.d1_recorteSinEdicion = await ev(`(function(){ const src=String(onTLUp);
  const i=src.indexOf("trimL"); const b=src.slice(i,i+240);
  return { tieneGuarda:/_undone\\s*\\)\\s*cutOverlapsOnDrop/.test(b), fragmento:b.slice(0,150) }; })()`);

/* D2 · rehacer conserva los trashIds, asi que el medio revive al deshacer otra vez */
out.d2_redoConservaTrash = await ev(`(function(){
  // se fabrica un medio SIN clips que lo usen: el caso que el hilo de trashIds existe para cubrir
  const M={id:uid(),name:'huerfano.png',kind:'image',w:8,h:8,dur:5,color:'#888'};
  state.media.push(M);
  pushUndo([M.id]);                                  // borrar del panel
  state.media=state.media.filter(x=>x.id!==M.id); state.mediaTrash=state.mediaTrash||{}; state.mediaTrash[M.id]=M;
  const trasBorrar=!mediaById(M.id);
  undo();   const trasUndo=!!mediaById(M.id);        // revive
  redo();   const trasRedo=!mediaById(M.id);         // se entierra
  undo();   const trasUndo2=!!mediaById(M.id);       // AQUI fallaba: no revivia
  state.media=state.media.filter(x=>x.id!==M.id); if(state.mediaTrash)delete state.mediaTrash[M.id];
  return {trasBorrar, trasUndo, trasRedo, trasUndo2, elMedioSobrevive:trasUndo2}; })()`);

/* E7 · el camino de disco escribe proxyFps */
out.e7_proxyFpsEnDisco = await ev(`(function(){ const src=String(makeProxy);
  const i=src.indexOf('bindProxyFile'); const b=src.slice(Math.max(0,i-520), i+40);
  return { loEscribe:/m\\.proxyFps\\s*=\\s*fps/.test(b) }; })()`);

/* E4 · loadP resuelve aunque el archivo de error */
out.e4_loadNoSeCuelga = await ev(`(async function(){
  const vi={vel:document.createElement('video'), vsrc:null, ready:false};
  bindVideoSrc(vi,'file:///no/existe/'+Date.now()+'.mp4');
  const t0=performance.now();
  const resolvio=await Promise.race([ vi.loadP.then(()=>true), new Promise(r=>setTimeout(()=>r(false),6000)) ]);
  return {resolvio, msTardado:Math.round(performance.now()-t0), ready:vi.ready}; })()`);

out.errs = await ev(`window.__errs.slice(0,20)`);
console.log(JSON.stringify(out,null,1));
ws.close();
