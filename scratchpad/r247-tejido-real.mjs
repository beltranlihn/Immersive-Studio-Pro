/* [R247] Tejido con MATERIAL REAL de la carpeta de Descargas de Beltran, que trae proporciones muy distintas
   (es justo el caso que le preocupaba). Importa las imagenes por ruta, monta el tejido y graba el video.
   Sin acentos graves dentro de las plantillas. */
import http from 'http';
import fs from 'fs';
import path from 'path';
const PORT=process.argv[2]||9222;
const FPS=25, SEGS=7;
const DL=path.join(process.env.USERPROFILE,'Downloads');
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:PORT,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:120000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

/* elegir unas cuantas imagenes de Descargas */
const files=fs.readdirSync(DL).filter(f=>/\.(png|jpe?g|webp)$/i.test(f)).slice(0,40);
const pick=['bid-side-plank.jpg','28205.jpg','image_iphone.jpg','close-grip-push-up-800.jpg',
            'Band-Reverse-Flys-Guide.jpg','EX387.jpg'].filter(f=>files.includes(f));
const usar=(pick.length>=4?pick:files).slice(0,6);
console.log('usando:',usar.join(' · '));

await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e))); return 1; })()`);
await ev(`state.dirty=false;1`);
await ev(`(async()=>{ await newProject('dome',2048,2048,60,180,true); })()`); await wait(800);
await ev(`(function(){ const b=document.querySelector('#viewModeSeg button[data-v="2d"]'); if(b)b.click();
  state.view.showGrid=false; state.view.showOutline=false; state.view.hfade=false; state.motionPreview=true; resize(); render(); return 1; })()`); await wait(400);

/* importar por RUTA: se lee el archivo con fetch sobre su file:// y se mete como imagen normal */
await ev(`window.__addImg=function(ruta,nombre){ return new Promise(res=>{
  const url=DSP.toFileURL(ruta); const img=new Image();
  img.onload=()=>{ const cv=document.createElement('canvas'); cv.width=img.naturalWidth; cv.height=img.naturalHeight;
    cv.getContext('2d').drawImage(img,0,0);
    const m={id:uid(),kind:'image',name:nombre,el:cv,originalEl:cv,tex:newTex(),w:cv.width,h:cv.height,dur:10,fps:0,
             color:clipColorFor('image'),path:ruta,missing:false,_loading:false};
    upTex(m.tex,cv); try{m.thumb=cv.toDataURL();}catch(e){}
    state.media.push(m); res({n:nombre,w:m.w,h:m.h,prop:+(m.w/m.h).toFixed(3)}); };
  img.onerror=()=>res(null); img.src=url; }); };1`);

const infos=[];
for(const f of usar){ const r=await ev(`__addImg(${JSON.stringify(path.join(DL,f))},${JSON.stringify(f)})`); if(r)infos.push(r); }
await ev(`renderMedia();1`);
console.log('importadas:'); infos.forEach(i=>console.log('   '+i.n+'  '+i.w+'x'+i.h+'  ('+i.prop+')'));

await ev(`window.__grab=function(clock){ _previewClock=clock; render();
  const S=Math.min(glc.width,glc.height), sx=Math.round((glc.width-S)/2), sy=Math.round((glc.height-S)/2);
  const cv=document.createElement('canvas'); cv.width=cv.height=480; const g=cv.getContext('2d');
  g.fillStyle='#000'; g.fillRect(0,0,480,480); g.drawImage(glc, sx,sy,S,S, 0,0,480,480);
  return cv.toDataURL('image/png'); };1`);

async function toma(nombre,cfg){
  const dir=path.join(process.cwd(),'scratchpad','r247r-'+nombre);
  fs.rmSync(dir,{recursive:true,force:true}); fs.mkdirSync(dir,{recursive:true});
  const info=await ev(`(function(){ state.clips=[]; state.media=state.media.filter(m=>m.kind!=='nest');
    const ids=state.media.filter(m=>m.kind==='image').map(m=>m.id);
    const nest=createComposition(Object.assign({kind:'weave',mediaIds:ids},${JSON.stringify(cfg)}));
    state.playhead=1; state.view.showGrid=false; renderTimeline(); render();
    return { n:nest?nest.nestClips.length:0 }; })()`);
  await wait(700);
  const N=FPS*SEGS;
  for(let i=0;i<N;i++){ const url=await ev(`__grab(${(i/FPS).toFixed(4)})`);
    fs.writeFileSync(path.join(dir,'f'+String(i).padStart(4,'0')+'.png'), Buffer.from(url.split(',')[1],'base64')); }
  console.log(nombre+': '+info.n+' clips, '+N+' fotogramas');
}

await toma('tejido',   {bands:5,weaveMode:'weave',fit:'across',density:1.0,speed:0.10,alternate:true});
await toma('alolargo', {bands:5,weaveMode:'weave',fit:'along', density:1.0,speed:0.10,alternate:true});
await toma('tiras',    {bands:7,weaveMode:'h',    fit:'across',density:1.0,speed:0.12,alternate:true});

await ev(`_previewClock=0; render(); 1`);
console.log('errs:',JSON.stringify(await ev(`window.__errs.slice(0,8)`)));
ws.close();
