/* [R246] Graba el túnel en movimiento: captura el lienzo real fotograma a fotograma adelantando el reloj de
   previsualización, recorta el disco en cuadrado y deja los PNG listos para que ffmpeg los junte en un mp4.
   Sin guías ni rótulos: se graba lo que se proyectaría. */
import http from 'http';
import fs from 'fs';
import path from 'path';
const PORT=process.argv[2]||9222;
const FPS=25, SEGS=8;                                  // 8 s a 25 fps = 200 fotogramas (2 ciclos a 0,25/s)
const DIR=path.join(process.cwd(),'scratchpad','r246-video');
fs.rmSync(DIR,{recursive:true,force:true}); fs.mkdirSync(DIR,{recursive:true});
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:PORT,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:90000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e))); return 1; })()`);
await ev(`state.dirty=false;1`);
await ev(`(async()=>{ await newProject('dome',2048,2048,60,180,true); })()`); await wait(800);
await ev(`(function(){ const b=document.querySelector('#viewModeSeg button[data-v="2d"]'); if(b)b.click();
  state.view.showGrid=false; state.view.showOutline=false; state.view.hfade=false; state.motionPreview=true;
  resize(); render(); return 1; })()`); await wait(400);

/* anillos con alfa (el generador de formas sólo hace rellenos) */
const prep=await ev(`(function(){
  const mk=(nombre,rFrac,grosor,color)=>{ const S=512, cv=document.createElement('canvas'); cv.width=cv.height=S;
    const x=cv.getContext('2d'); x.clearRect(0,0,S,S);
    x.strokeStyle=color; x.lineWidth=S*grosor; x.beginPath(); x.arc(S/2,S/2,S*rFrac,0,7); x.stroke();
    const m={id:uid(),kind:'image',name:nombre,el:cv,originalEl:cv,tex:newTex(),w:S,h:S,dur:12,fps:0,color:'#8ECAE6',missing:false,_loading:false};
    upTex(m.tex,cv); try{m.thumb=cv.toDataURL();}catch(e){} state.media.push(m); return m; };
  mk('anillo-A',0.42,0.045,'#FFFFFF'); mk('anillo-B',0.40,0.030,'#7FD4FF'); mk('anillo-C',0.44,0.060,'#FFB37F');
  mk('anillo-D',0.38,0.022,'#C8A2FF');
  renderMedia();
  const ids=state.media.filter(m=>/^anillo-/.test(m.name)).map(m=>m.id);
  const nest=createComposition({kind:'tunnel',mediaIds:ids,count:12,sizeFrom:1,sizeTo:240,speed:0.25,curve:70,fade:true,twist:0});
  state.playhead=1; state.view.showGrid=false; renderTimeline(); render();
  return { elementos:nest?nest.nestClips.length:0, lienzo:[glc.width,glc.height] }; })()`);
console.log('montaje:',JSON.stringify(prep));

/* captura: recorte CUADRADO centrado (el disco) escalado a 480² */
await ev(`window.__grab=function(clock){ _previewClock=clock; render();
  const S=Math.min(glc.width,glc.height), sx=Math.round((glc.width-S)/2), sy=Math.round((glc.height-S)/2);
  const cv=document.createElement('canvas'); cv.width=cv.height=480; const g=cv.getContext('2d');
  g.fillStyle='#000000'; g.fillRect(0,0,480,480);
  g.drawImage(glc, sx,sy,S,S, 0,0,480,480);
  return cv.toDataURL('image/png'); };1`);

const N=FPS*SEGS;
for(let i=0;i<N;i++){
  const url=await ev(`__grab(${(i/FPS).toFixed(4)})`);
  fs.writeFileSync(path.join(DIR,'f'+String(i).padStart(4,'0')+'.png'), Buffer.from(url.split(',')[1],'base64'));
  if(i%25===0)console.log('  fotograma '+i+'/'+N);
}
await ev(`_previewClock=0; render(); 1`);
const errs=await ev(`window.__errs.slice(0,10)`);
console.log('errs:',JSON.stringify(errs));
console.log('LISTO · '+N+' fotogramas en '+DIR);
ws.close();
