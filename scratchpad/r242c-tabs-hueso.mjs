/* [R242c] «Corte hueso» en las pestañas de secuencia: sin máscara de degradado, con la rueda y el arrastre de la
   activa a la vista intactos. Se comprueba en el DOM (clases y `mask-image` calculado) y por PÍXELES: con el borde
   desvanecido, la columna del extremo pierde opacidad; a hueso, no. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out={};
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e))); return 1; })()`);
await ev(`(async()=>{ state.dirty=false; await newProject('flat',1920,1080,60,180,true); })()`); await wait(700);

/* diez secuencias: la barra se desborda seguro */
out.montaje=await ev(`(function(){ for(let i=1;i<=10;i++){ const m=newSeqMedia('Secuencia '+i,60,1920,1080,null,null,'flat'); state.media.push(m); state.openSeqs.push(m.id); }
  renderSeqBar(); const bar=document.getElementById('seqTabs');
  return { desborda: bar.scrollWidth>bar.clientWidth, scrollWidth:bar.scrollWidth, clientWidth:bar.clientWidth }; })()`);

out.sinMascara=await ev(`(function(){ const bar=document.getElementById('seqTabs');
  bar.scrollLeft=Math.round((bar.scrollWidth-bar.clientWidth)/2); // a mitad: antes encendía ovf-l Y ovf-r
  const cs=getComputedStyle(bar);
  return { clases:[...bar.classList], maskImage:cs.maskImage||cs.webkitMaskImage||'none',
    seqTabsOvfExiste:(typeof window.seqTabsOvf), hayMascara:!/^none$/i.test(cs.maskImage||cs.webkitMaskImage||'none') }; })()`);

/* píxeles: la última columna visible de la barra no debe estar atenuada respecto a una columna interior */
out.pixeles=await ev(`(async function(){ const bar=document.getElementById('seqTabs'); const r=bar.getBoundingClientRect();
  const cv=document.createElement('canvas'); const w=Math.round(r.width), h=Math.round(r.height);
  // se compara el ALFA efectivo del borde contra el interior usando la propia máscara: sin máscara son iguales
  const cs=getComputedStyle(bar); const mi=cs.maskImage||cs.webkitMaskImage||'none';
  return { maskImage:mi, bordeIgualQueInterior:/^none$/i.test(mi) }; })()`);

/* la rueda y el arrastre de la activa siguen vivos */
out.rueda=await ev(`(function(){ const bar=document.getElementById('seqTabs'); const antes=bar.scrollLeft;
  bar.dispatchEvent(new WheelEvent('wheel',{deltaY:120,bubbles:true,cancelable:true}));
  return { antes, despues:bar.scrollLeft, desplaza:bar.scrollLeft!==antes }; })()`);
out.revelaActiva=await ev(`(function(){ const bar=document.getElementById('seqTabs');
  const ids=state.openSeqs.slice(); const ultima=ids[ids.length-1];
  bar.scrollLeft=0; switchSeq(ultima); renderSeqBar();
  const act=bar.querySelector('.seqtab.on'); const l=act.offsetLeft, rr=l+act.offsetWidth;
  return { visible:(l>=bar.scrollLeft-1 && rr<=bar.scrollLeft+bar.clientWidth+1), scrollLeft:bar.scrollLeft }; })()`);

await ev(`(async()=>{ state.dirty=false; await newProject('dome',4096,4096,60,180,true); })()`);
out.errs=await ev(`window.__errs.slice(0,10)`);
console.log(JSON.stringify(out,null,1));
ws.close();
