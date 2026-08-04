/* [R246] Pantallazo del diálogo de composición con el tipo TÚNEL seleccionado.
   Se monta antes un proyecto de domo con cuatro fuentes de anillo, para que la lista de medios y la vista previa
   del diálogo muestren algo real y no un panel vacío. */
import http from 'http';
import fs from 'fs';
import path from 'path';
const PORT=process.argv[2]||9222;
const OUT=path.join(process.cwd(),'scratchpad','r246-shots');
fs.mkdirSync(OUT,{recursive:true});
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:PORT,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e))); return 1; })()`);
await ev(`state.dirty=false;1`);
await ev(`(async()=>{ await newProject('dome',2048,2048,60,180,true); })()`); await wait(800);

/* cuatro fuentes de anillo con alfa, para que el diálogo tenga material que listar */
await ev(`(function(){
  const mk=(nombre,rFrac,grosor,color)=>{ const S=512, cv=document.createElement('canvas'); cv.width=cv.height=S;
    const x=cv.getContext('2d'); x.clearRect(0,0,S,S);
    x.strokeStyle=color; x.lineWidth=S*grosor; x.beginPath(); x.arc(S/2,S/2,S*rFrac,0,7); x.stroke();
    const m={id:uid(),kind:'image',name:nombre,el:cv,originalEl:cv,tex:newTex(),w:S,h:S,dur:12,fps:0,color:'#8ECAE6',missing:false,_loading:false};
    upTex(m.tex,cv); try{m.thumb=cv.toDataURL();}catch(e){} state.media.push(m); return m; };
  mk('anillo-fino.png',0.42,0.030,'#FFFFFF'); mk('anillo-medio.png',0.40,0.050,'#7FD4FF');
  mk('anillo-grueso.png',0.44,0.075,'#FFB37F'); mk('halo.png',0.36,0.020,'#C8A2FF');
  renderMedia(); return 1; })()`); await wait(400);

/* abrir el diálogo en TÚNEL y marcar las cuatro fuentes */
const box=await ev(`(function(){ openCompose('tunnel');
  document.querySelectorAll('#cMedia input[type=checkbox]').forEach(i=>{ i.checked=true; });
  const n=document.getElementById('cN'); if(n){ n.value=12; }
  const ev2=new Event('change',{bubbles:true}); const cm=document.getElementById('cMedia'); if(cm)cm.dispatchEvent(ev2);
  const sp=document.getElementById('cTSpeed'); if(sp){ sp.value=25; sp.dispatchEvent(new Event('input',{bubbles:true})); }
  const cv=document.getElementById('cTCurve'); if(cv){ cv.value=70; cv.dispatchEvent(new Event('input',{bubbles:true})); }
  const tt=document.getElementById('cTTo'); if(tt){ tt.value=240; tt.dispatchEvent(new Event('input',{bubbles:true})); }
  const md=document.querySelector('#compOv .modal'); const r=md.getBoundingClientRect();
  return { x:Math.max(0,Math.floor(r.left)-14), y:Math.max(0,Math.floor(r.top)-14),
           w:Math.ceil(r.width)+28, h:Math.ceil(r.height)+28, dpr:window.devicePixelRatio||1 }; })()`);
await wait(500);
console.log('caja del diálogo:',JSON.stringify(box));

const shot=await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,
  clip:{x:box.x,y:box.y,width:box.w,height:box.h,scale:2}});
fs.writeFileSync(path.join(OUT,'dialogo-tunel.png'), Buffer.from(shot.data,'base64'));

/* la vista previa del diálogo es un <canvas>: si el pantallazo del protocolo la deja en blanco, se guarda aparte
   (gotcha ya conocido de R227 — el protocolo puede devolver una textura de canvas rancia) */
const prev=await ev(`(function(){ const c=document.getElementById('cPrev'); return c?c.toDataURL('image/png'):null; })()`);
if(prev)fs.writeFileSync(path.join(OUT,'dialogo-preview.png'), Buffer.from(prev.split(',')[1],'base64'));

await ev(`(function(){ const o=document.getElementById('compOv'); if(o)o.remove(); return 1; })()`);
console.log('errs:',JSON.stringify(await ev(`window.__errs.slice(0,5)`)));
console.log('guardado en '+OUT);
ws.close();
