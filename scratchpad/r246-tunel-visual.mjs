/* [R246] Prueba VISUAL del túnel: genera tres anillos CON ALFA (trazo, centro transparente), monta el compose y
   captura el lienzo real del domo en varios instantes del reloj de previsualización.
   Las capturas se guardan en scratchpad/r246-shots/ para poder MIRARLAS — una sonda numérica dice que el motor
   hace lo que se le pide, no que se vea bien. */
import http from 'http';
import fs from 'fs';
import path from 'path';
const PORT=process.argv[2]||9222;
const DIR=path.join(process.cwd(),'scratchpad','r246-shots');
fs.mkdirSync(DIR,{recursive:true});
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:PORT,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:90000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out={};
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e))); return 1; })()`);

/* proyecto de domo limpio, vista 2D (el disco fisheye, que es lo que se proyecta) */
await ev(`state.dirty=false;1`);
await ev(`(async()=>{ await newProject('dome',2048,2048,60,180,true); })()`); await wait(800);
await ev(`(function(){ const b=document.querySelector('#viewModeSeg button[data-v="2d"]'); if(b)b.click(); resize(); return 1; })()`); await wait(400);

/* --- tres ANILLOS con alfa, dibujados a mano (el generador de formas sólo hace rellenos) --- */
out.fuentes=await ev(`(function(){
  const mk=(nombre,rFrac,grosor,color)=>{
    const S=512, cv=document.createElement('canvas'); cv.width=cv.height=S;
    const x=cv.getContext('2d'); x.clearRect(0,0,S,S);            // TODO transparente salvo el trazo
    x.strokeStyle=color; x.lineWidth=S*grosor; x.beginPath(); x.arc(S/2,S/2,S*rFrac,0,7); x.stroke();
    const m={id:uid(),kind:'image',name:nombre,el:cv,originalEl:cv,tex:newTex(),w:S,h:S,dur:8,fps:0,
             color:'#8ECAE6',missing:false,_loading:false};
    upTex(m.tex,cv); try{ m.thumb=cv.toDataURL(); }catch(e){}
    state.media.push(m); return m; };
  const a=mk('anillo-A',0.42,0.05,'#FFFFFF'), b=mk('anillo-B',0.40,0.03,'#7FD4FF'), c=mk('anillo-C',0.44,0.07,'#FFB37F');
  renderMedia();
  /* comprobar que de verdad hay alfa: el centro debe estar vacío y el trazo opaco */
  const cx=a.el.getContext('2d'); const centro=cx.getImageData(256,256,1,1).data[3], trazo=cx.getImageData(256,256-Math.round(512*0.42),1,1).data[3];
  return { creadas:3, alfaCentro:centro, alfaTrazo:trazo, tieneAlfaDeVerdad:(centro===0&&trazo>200), ids:[a.id,b.id,c.id] }; })()`);

/* --- montar el túnel --- */
out.montaje=await ev(`(function(){
  const ids=state.media.filter(m=>m.kind==='image'&&/^anillo-/.test(m.name)).map(m=>m.id);
  const nest=createComposition({kind:'tunnel',mediaIds:ids,count:9,sizeFrom:1,sizeTo:230,speed:0.14,curve:65,fade:true,twist:0});
  if(!nest)return {err:'no se creó'};
  state.playhead=1; state.motionPreview=true;
  renderTimeline(); render();
  return { elementos:nest.nestClips.length, dur:+nest.dur.toFixed(1), clipsEnTimeline:state.clips.length }; })()`);
await wait(700);

/* --- capturar el lienzo en varios instantes del reloj de previsualización --- */
const shot=async(nombre,clock)=>{
  const d=await ev(`(function(){ _previewClock=${clock}; render();
    const cv=document.createElement('canvas'); cv.width=glc.width; cv.height=glc.height;
    const g=cv.getContext('2d'); g.fillStyle='#0E0F11'; g.fillRect(0,0,cv.width,cv.height);
    g.drawImage(glc,0,0); g.drawImage(gridc,0,0);
    let n=0; const d2=g.getImageData(0,0,cv.width,cv.height).data; for(let i=3;i<d2.length;i+=4)if(d2[i]>8)n++;
    return { url:cv.toDataURL('image/png'), pintado:+(n/(cv.width*cv.height)).toFixed(3), w:cv.width, h:cv.height }; })()`);
  fs.writeFileSync(path.join(DIR,nombre+'.png'), Buffer.from(d.url.split(',')[1],'base64'));
  return { pintado:d.pintado, px:d.w+'x'+d.h }; };

out.capturas={};
out.capturas.t000=await shot('tunel-00',0);
out.capturas.t120=await shot('tunel-01',1.2);
out.capturas.t240=await shot('tunel-02',2.4);
out.capturas.t360=await shot('tunel-03',3.6);

/* los tamaños en esos mismos instantes, para cruzar lo que se ve con lo que manda el motor */
out.tamanos=await ev(`(function(){ const nest=state.media.find(m=>m.comp&&m.comp.kind==='tunnel');
  const r={}; for(const ck of [0,1.2,2.4,3.6]){ _previewClock=ck;
    r['clock'+ck]=nest.nestClips.map(c=>+evalR(c,'size',state.playhead).toFixed(0)).sort((a,b)=>a-b); }
  _previewClock=0; render(); return r; })()`);

out.errs=await ev(`window.__errs.slice(0,10)`);
console.log(JSON.stringify(out,null,1));
console.log('capturas en: '+DIR);
ws.close();
