/* [R247c] Graba el tejido nuevo en movimiento. Tres tomas con MATERIAL REAL de la carpeta de Descargas de Beltran
   (proporciones mezcladas a proposito) y una con fuentes opacas generadas, donde el entrelazado se lee mejor.
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

await cmd('Page.enable'); await cmd('Page.reload',{ignoreCache:true}); await wait(3500);
await ev(`state.dirty=false;1`);
await ev(`(async()=>{ await newProject('dome',2048,2048,60,180,true); })()`); await wait(900);
await ev(`(function(){ const b=document.querySelector('#viewModeSeg button[data-v="2d"]'); if(b)b.click();
  state.view.showGrid=false; state.view.showOutline=false; state.view.hfade=false; state.motionPreview=true;
  state.view.zoom=1; state.view.pan=[0,0]; resize(); render(); return 1; })()`); await wait(400);

await ev(`window.__addImg=function(ruta,nombre){ return new Promise(res=>{
  const url=DSP.toFileURL(ruta); const img=new Image();
  img.onload=()=>{ const cv=document.createElement('canvas'); cv.width=img.naturalWidth; cv.height=img.naturalHeight;
    cv.getContext('2d').drawImage(img,0,0);
    const m={id:uid(),kind:'image',name:nombre,el:cv,originalEl:cv,tex:newTex(),w:cv.width,h:cv.height,dur:10,fps:0,
             color:clipColorFor('image'),path:ruta,missing:false,_loading:false};
    upTex(m.tex,cv); try{m.thumb=cv.toDataURL();}catch(e){} state.media.push(m); res(1); };
  img.onerror=()=>res(0); img.src=url; }); };
window.__opacas=function(){ state.media=state.media.filter(m=>m.kind!=='image');
  const mk=(nombre,W,H,color)=>{ const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
    const x=cv.getContext('2d'); x.fillStyle=color; x.fillRect(0,0,W,H);
    x.strokeStyle='rgba(0,0,0,.8)'; x.lineWidth=Math.max(3,Math.min(W,H)*0.06); x.strokeRect(0,0,W,H);
    const r=Math.min(W,H)*0.33; x.beginPath(); x.arc(W/2,H/2,r,0,7); x.stroke();
    const m={id:uid(),kind:'image',name:nombre,el:cv,originalEl:cv,tex:newTex(),w:W,h:H,dur:10,fps:0,color,missing:false,_loading:false};
    upTex(m.tex,cv); try{m.thumb=cv.toDataURL();}catch(e){} state.media.push(m); return m; };
  mk('1x1',512,512,'#7FD4FF'); mk('16x9',960,540,'#FFB37F'); mk('9x16',540,960,'#C8A2FF');
  mk('4x3',640,480,'#9BE59B'); mk('1x1b',512,512,'#FF9BC4'); mk('3x2',720,480,'#E8E07F');
  renderMedia(); return 1; };
window.__grab=function(clock){ _previewClock=clock; render();
  const S=Math.min(glc.width,glc.height), sx=Math.round((glc.width-S)/2), sy=Math.round((glc.height-S)/2);
  const cv=document.createElement('canvas'); cv.width=cv.height=480; const g=cv.getContext('2d');
  g.fillStyle='#000'; g.fillRect(0,0,480,480); g.drawImage(glc, sx,sy,S,S, 0,0,480,480); return cv.toDataURL('image/png'); };1`);

const files=fs.readdirSync(DL).filter(f=>/\.(png|jpe?g)$/i.test(f)).slice(0,8);
async function reales(){ await ev(`state.media=state.media.filter(m=>m.kind!=='image');1`);
  for(const f of files) await ev(`__addImg(${JSON.stringify(path.join(DL,f))},${JSON.stringify(f)})`);
  await ev(`renderMedia();1`); }

async function toma(nombre,cfg,opacas){
  const dir=path.join(process.cwd(),'scratchpad','r247c-'+nombre);
  fs.rmSync(dir,{recursive:true,force:true}); fs.mkdirSync(dir,{recursive:true});
  if(opacas) await ev(`__opacas();1`); else await reales();
  const info=await ev(`(function(){ state.clips=[]; state.media=state.media.filter(m=>m.kind!=='nest');
    const ids=state.media.filter(m=>m.kind==='image').map(m=>m.id);
    const nest=createComposition(Object.assign({kind:'weave',mediaIds:ids},${JSON.stringify(cfg)}));
    state.playhead=1; renderTimeline(); render(); return { n:nest?nest.nestClips.length:0 }; })()`);
  await wait(700);
  const N=FPS*SEGS;
  for(let i=0;i<N;i++){ const url=await ev(`__grab(${(i/FPS).toFixed(4)})`);
    fs.writeFileSync(path.join(dir,'f'+String(i).padStart(4,'0')+'.png'), Buffer.from(url.split(',')[1],'base64')); }
  console.log(nombre+': '+info.n+' clips, '+N+' fotogramas');
}

await toma('tejido',  {bands:5,weaveMode:'weave',fit:'across',density:1.0,speed:0.10,alternate:true,interlace:true,fish:50},false);
await toma('opacas',  {bands:5,weaveMode:'weave',fit:'across',density:1.0,speed:0.10,alternate:true,interlace:true,fish:50},true);
await toma('along',   {bands:4,weaveMode:'weave',fit:'along', density:1.0,speed:0.09,alternate:true,interlace:true,fish:50},false);

await ev(`_previewClock=0; state.view.zoom=0.92; render(); 1`);
ws.close();
