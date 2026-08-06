/* [R286b] Verificacion de los hallazgos de la revision de R266->R286. */
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

// 1 · `adjust` y `kfLink` ya no viajan en el pegado
out.f1_exclusiones = await ev(`({adjust:ATTR_FUERA.has('adjust'), kfLink:ATTR_FUERA.has('kfLink'),
  siguenDentro:['id','mediaId','lane','start','dur','inP'].every(k=>ATTR_FUERA.has(k))})`);

// 2 · pegar sobre una capa de ajuste no la convierte en clip (ni al reves)
out.f2_capaAjuste = await ev(`(function(){ const cl=state.clips.filter(c=>!c.adjust); if(!cl.length)return {saltado:1};
  const src=cl[0]; const aj=makeAdjustClip?makeAdjustClip(src.lane,src.start,2):null; if(!aj)return {saltado:'sin makeAdjustClip'};
  state.clips.push(aj);
  copyAttrs([src]); pasteAttrs([aj]);
  const r={ajusteSigueSiendoAjuste:aj.adjust===true, mediaIdIntacto:aj.mediaId===null};
  copyAttrs([aj]); pasteAttrs([src]);
  r.clipNoSeVolvioAjuste=!src.adjust;
  state.clips=state.clips.filter(c=>c!==aj); return r; })()`);

// 3 · la reproduccion PARA al final del tramo, arrancando fuera de el
out.f3_paraEnElTramo = await ev(`(async function(){ state.workIn=2; state.workOut=4; state.playhead=0.5;
  play(); await new Promise(r=>setTimeout(r,5200));
  const ph=state.playhead, sigue=state.playing; if(sigue)pause();
  state.workIn=null; state.workOut=null; state.playhead=0;
  return {playheadFinal:+ph.toFixed(2), seguiaSonando:sigue, paroEnWorkOut:Math.abs(ph-4)<0.35}; })()`);

// 4 · el fotograma suelto pasa por la chapa (recorte al circulo incluido)
out.f4_stillPasaPorChapa = await ev(`(function(){ const src=String(runExport);
  const i=src.indexOf("codec==='still'"); const bloque=src.slice(i,i+2600); // la ventana tiene que cubrir el comentario largo
  return {llamaAChapaLienzo:/chapaLienzo\\(/.test(bloque), usaElResultado:/_q\\.toBlob/.test(bloque)}; })()`);

// 5 · el lienzo de la chapa se suelta al terminar el export
out.f5_sueltaElLienzo = await ev(`(function(){ const src=String(runExport);
  return {cleanupLoSuelta:/_chapaCv=null/.test(src)}; })()`);

// 6 · abrir el cuadro de la chapa no ensucia el proyecto
out.f6_noEnsucia = await ev(`(async function(){ state.dirty=false; projTitle&&projTitle();
  openSlateDialog(); await new Promise(r=>setTimeout(r,900));
  const sucioTrasAbrir=!!state.dirty;
  const ov=[...document.querySelectorAll('.overlay')].pop(); if(ov)ov.remove();
  return {sucioTrasAbrir, esperado:false}; })()`);

// 7 · en domo no se asigna el canvas de fondo que no se usa
out.f7_sinCanvasMuerto = await ev(`(function(){ const src=String(runExport);
  return {condicionaPorModo:/planchar\\s*&&\\s*state\\.seqMode!=='dome'/.test(src)}; })()`);

out.errs = await ev(`window.__errs.slice(0,20)`);
console.log(JSON.stringify(out,null,1));
ws.close();
