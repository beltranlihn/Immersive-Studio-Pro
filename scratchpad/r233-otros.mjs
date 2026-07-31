/* [R233] El clamp del blit lo comparten domo, 2D plano y sala: que ninguno pierda contenido en el borde. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out={};
await ev(`window.__errs=[];addEventListener('error',e=>__errs.push(String(e.message||e)));
 const ce=console.error;console.error=function(){try{__errs.push('con: '+[...arguments].map(String).join(' '));}catch(_){}return ce.apply(console,arguments);};1`);

/* cuenta píxeles NO transparentes del lienzo GL: si el clamp comiera contenido, bajaría */
await ev(`window.__cobertura=function(){ const cv=document.createElement('canvas'); cv.width=glc.width; cv.height=glc.height;
  const g=cv.getContext('2d'); g.drawImage(glc,0,0); const d=g.getImageData(0,0,cv.width,cv.height).data;
  let n=0,tot=cv.width*cv.height; for(let i=3;i<d.length;i+=4)if(d[i]>8)n++;
  return {pintados:n, total:tot, frac:+(n/tot).toFixed(4)}; };1`);

for(const fmt of ['dome','flat','room']){
  await ev(`(async()=>{try{await startDemoProject('${fmt}');}catch(e){window.__d=String(e);}})()`); await wait(2400);
  await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){}
    const b=document.querySelector('#viewModeSeg button[data-v="2d"]'); if(b)b.click(); state.playhead=6; resize(); vpFit(); render(); return 1;})()`); await wait(700);
  out[fmt]={ modo:await ev(`state.seqMode`), lienzo:await ev(`[state.seqW,state.seqH]`), cobertura:await ev(`__cobertura()`) };
}

/* y el 3D de la sala, que usa otro camino pero comparte el composite */
await ev(`(function(){ const b=document.querySelector('#viewModeSeg button[data-v="3d"]'); if(b)b.click(); return 1; })()`); await wait(900);
out.room3D = await ev(`__cobertura()`);
await ev(`(function(){ const b=document.querySelector('#viewModeSeg button[data-v="2d"]'); if(b)b.click(); return 1; })()`); await wait(400);

out.errs = await ev(`window.__errs.slice(0,15)`);
console.log(JSON.stringify(out,null,1));
ws.close();
