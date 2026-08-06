/* [R286c] Los tres que quedaban de la revision de R266->R286. */
import http from 'http';
const t=await new Promise((r2,rj)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>r2(JSON.parse(b)));}).on('error',rj);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await ev(`window.__errs=[];addEventListener('error',e=>__errs.push(String(e.message||e)));
 const ce=console.error;console.error=function(){try{__errs.push('con: '+[...arguments].map(String).join(' '));}catch(_){}return ce.apply(console,arguments);};1`);
await ev(`(async()=>{try{await startDemoProject('dome');}catch(e){window.__d=String(e);}})()`); await wait(2600);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){} resize(); return 1;})()`); await wait(700);
const out={};

/* A · el deshacer alcanza a los bucles de OTRAS secuencias */
out.A_undoNidos = await ev(`(function(){
  // se fabrica un nido con un clip en bucle del mismo medio que el monitor va a marcar
  const med=state.media.find(m=>m.kind!=='audio'&&!isSeqMedia(m)); if(!med)return {saltado:'sin medio'};
  const nido=newSeqMedia('NidoPrueba',state.fps,state.seqW,state.seqH,null,null,state.seqMode,state.seqCov);
  const cl=makeClip(med,0,0,{},{name:'enBucle'}); cl.loop=true; cl.inP=0; cl.loopLen=Math.max(0.5,(med.dur||4));
  cl.dur=Math.max(2,(med.dur||4)*2); nido.nestClips=[cl]; state.media.push(nido);
  const antes={inP:cl.inP, loopLen:+cl.loopLen.toFixed(3)};
  // se simula el gesto del monitor: pushUndo con la foto de nidos + aplicar el tramo
  pushUndo(null,null,nestLoopSnap()); bumpMeta&&bumpMeta();
  med.srcIn=1; med.srcOut=Math.min((med.dur||4), 1+Math.max(0.5,(med.dur||4)/3));
  const n=aplicarTramoAClipsEnBucle(med, med.srcIn, med.srcOut);
  const tras={inP:+cl.inP.toFixed(3), loopLen:+cl.loopLen.toFixed(3)};
  undo();
  const c2=(mediaById(nido.id).nestClips||[])[0];
  const trasUndo={inP:+((c2.inP||0)).toFixed(3), loopLen:+((c2.loopLen||0)).toFixed(3)};
  state.media=state.media.filter(m=>m.id!==nido.id);
  return {clipsTocados:n, antes, tras, trasUndo,
    elTramoSeAplico: Math.abs(tras.inP-antes.inP)>1e-3 || Math.abs(tras.loopLen-antes.loopLen)>1e-3,
    elUndoLoDeshizo: Math.abs(trasUndo.inP-antes.inP)<1e-3 && Math.abs(trasUndo.loopLen-antes.loopLen)<1e-3}; })()`);

/* B · el visor anuncia el MISMO rango que entregaria el export */
out.B_rango = await ev(`(function(){
  const r=()=>({visor:chapaDatos().durTxt, export_:TC(exRangoEfectivo(null).dur)});
  state.workIn=null; state.workOut=null; const sinMarcas=r();
  state.workIn=2; state.workOut=5; const conMarcas=r();
  const forzandoClips=({visor:chapaDatos().durTxt, export_:TC(exRangoEfectivo({range:'clips'}).dur)});
  state.workIn=null; state.workOut=null;
  return {sinMarcas, conMarcas, coincideSinMarcas:sinMarcas.visor===sinMarcas.export_,
    coincideConMarcas:conMarcas.visor===conMarcas.export_, forzandoClips}; })()`);

/* C · el respaldo en ZIP tambien pasa por la chapa */
out.C_zipPasaPorChapa = await ev(`(function(){ const src=String(runExport);
  const i=src.indexOf('const renderFrame='); const b=src.slice(i,i+900);
  return {llamaAChapaLienzo:/chapaLienzo\\(/.test(b), usaElResultado:/q\\.toBlob/.test(b)}; })()`);

out.errs = await ev(`window.__errs.slice(0,20)`);
console.log(JSON.stringify(out,null,1));
ws.close();
