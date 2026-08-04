/* [R247c] El tejido REHECHO sobre plano 1:1 + fulldome/fisheye, con entrelazado por cruces.
   Comprueba tres cosas que Beltran pidio y una que se rompio antes:
     1) ningun clip deformado (proporcion dibujada == proporcion de la fuente),
     2) los vecinos se juntan a 90 grados (el nido es plano: los angulos son 0 o 90, nada intermedio),
     3) nadie desaparece: el numero de clips dentro del lienzo es constante en el tiempo,
     4) el entrelazado existe (hay clips con rejilla de cruces y con paridad).
   Sin acentos graves dentro de las plantillas. */
import http from 'http';
import fs from 'fs';
import path from 'path';
const PORT=process.argv[2]||9222;
const DL=path.join(process.env.USERPROFILE,'Downloads');
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:PORT,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:120000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

/* en dev la app lee app.js del repo: recargar la pagina basta para tomar los cambios */
await cmd('Page.enable'); await cmd('Page.reload',{ignoreCache:true}); await wait(3500);
console.log('GPU:', await ev(`(function(){const g=glc.getContext('webgl2')||gl; const d=gl.getExtension('WEBGL_debug_renderer_info'); return d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):'?';})()`));
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e))); return 1; })()`);
await ev(`state.dirty=false;1`);
await ev(`(async()=>{ await newProject('dome',2048,2048,60,180,true); })()`); await wait(900);
await ev(`(function(){ const b=document.querySelector('#viewModeSeg button[data-v="2d"]'); if(b)b.click();
  state.view.showGrid=false; state.view.showOutline=false; state.view.hfade=false; state.motionPreview=true; resize(); render(); return 1; })()`); await wait(400);

/* imagenes reales de Descargas, con proporciones mezcladas a proposito */
await ev(`window.__addImg=function(ruta,nombre){ return new Promise(res=>{
  const url=DSP.toFileURL(ruta); const img=new Image();
  img.onload=()=>{ const cv=document.createElement('canvas'); cv.width=img.naturalWidth; cv.height=img.naturalHeight;
    cv.getContext('2d').drawImage(img,0,0);
    const m={id:uid(),kind:'image',name:nombre,el:cv,originalEl:cv,tex:newTex(),w:cv.width,h:cv.height,dur:10,fps:0,
             color:clipColorFor('image'),path:ruta,missing:false,_loading:false};
    upTex(m.tex,cv); try{m.thumb=cv.toDataURL();}catch(e){}
    state.media.push(m); res({n:nombre,w:m.w,h:m.h,prop:+(m.w/m.h).toFixed(3)}); };
  img.onerror=()=>res(null); img.src=url; }); };1`);

const files=fs.readdirSync(DL).filter(f=>/\.(png|jpe?g)$/i.test(f)).slice(0,8);
const infos=[];
for(const f of files){ const r=await ev(`__addImg(${JSON.stringify(path.join(DL,f))},${JSON.stringify(f)})`); if(r)infos.push(r); }
await ev(`renderMedia();1`);
console.log('fuentes:'); infos.forEach(i=>console.log('   '+i.n+'  '+i.w+'x'+i.h+'  ('+i.prop+')'));

const r=await ev(`(function(){
  state.clips=[]; state.media=state.media.filter(m=>m.kind!=='nest');
  const ids=state.media.filter(m=>m.kind==='image').map(m=>m.id);
  const nest=createComposition({kind:'weave',mediaIds:ids,bands:5,weaveMode:'weave',fit:'across',
                                density:1.0,speed:0.10,alternate:true,interlace:true,fish:35});
  if(!nest) return {err:'sin nido'};
  const host=state.clips.find(c=>{const m=mediaById(c.mediaId); return m&&m.kind==='nest';});
  return { modo:nest.mode, w:nest.w, h:nest.h, clips:nest.nestClips.length,
           fulldome:!!(host&&host.props.fulldome), fisheye:!!(host&&host.props.fisheye), fishAmt:host&&host.props.fisheyeAmt,
           conRejilla:nest.nestClips.filter(c=>c.props.weaveCells).length,
           angulos:[...new Set(nest.nestClips.map(c=>c.props.rot||0))].sort((a,b)=>a-b),
           sierra:nest.nestClips.filter(c=>c.anim&&c.anim[0]&&c.anim[0].mode==='saw').length,
           ejes:[...new Set(nest.nestClips.map(c=>c.anim&&c.anim[0]&&c.anim[0].param))] }; })()`);
console.log('\nNIDO:', JSON.stringify(r,null,1));

/* 1) proporciones: lo que el motor DIBUJA de verdad, clip a clip, contra la proporcion de su fuente */
const def=await ev(`(function(){
  const nest=state.media.find(m=>m.kind==='nest'); if(!nest)return {err:1};
  const bakF=_drawFlat, bakA=_compAspect; _drawFlat=true; _compAspect=1;
  let peor=0, n=0, mal=0;
  for(const c of nest.nestClips){ const m=mediaById(c.mediaId); if(!m)continue;
    const pl=flatPlace(c,m,1,1);
    const w=Math.hypot(pl.fx[0],pl.fx[1]), h=Math.hypot(pl.fy[0],pl.fy[1]);
    const dib=w/h, fuente=m.w/m.h;                       // flatPlace ya lleva el rot: comparamos contra la fuente o su giro
    const err=Math.min(Math.abs(dib/fuente-1), Math.abs(dib*fuente-1));
    n++; if(err>peor)peor=err; if(err>0.01)mal++; }
  _drawFlat=bakF; _compAspect=bakA;
  return { medidos:n, deformados:mal, peorError:+(peor*100).toFixed(3) }; })()`);
console.log('PROPORCIONES:', JSON.stringify(def));

/* 3) nadie desaparece: cuantos clips caen DENTRO del lienzo en varios instantes */
const cnt=await ev(`(function(){
  const nest=state.media.find(m=>m.kind==='nest'); if(!nest)return {err:1};
  const bakF=_drawFlat, bakA=_compAspect, bakC=_previewClock; _drawFlat=true; _compAspect=1;
  const serie=[];
  for(const T of [0,0.7,1.4,2.1,2.8,3.5,4.2,4.9,5.6,6.3]){ _previewClock=T; let dentro=0;
    for(const c of nest.nestClips){ const m=mediaById(c.mediaId); if(!m)continue;
      const pl=flatPlace(c,m,1,1); const w=Math.hypot(pl.fx[0],pl.fx[1]), h=Math.hypot(pl.fy[0],pl.fy[1]);
      if(Math.abs(pl.fc[0])<1+w && Math.abs(pl.fc[1])<1+h) dentro++; }
    serie.push(dentro); }
  _drawFlat=bakF; _compAspect=bakA; _previewClock=bakC;
  return serie; })()`);
console.log('DENTRO DEL LIENZO en 10 instantes:', JSON.stringify(cnt),
            ' → min '+Math.min(...cnt)+' / max '+Math.max(...cnt));

/* capturas */
const OUT=path.join(process.cwd(),'scratchpad','r247c');
fs.rmSync(OUT,{recursive:true,force:true}); fs.mkdirSync(OUT,{recursive:true});
await ev(`window.__grab=function(clock){ _previewClock=clock; render();
  const S=Math.min(glc.width,glc.height), sx=Math.round((glc.width-S)/2), sy=Math.round((glc.height-S)/2);
  const cv=document.createElement('canvas'); cv.width=cv.height=560; const g=cv.getContext('2d');
  g.fillStyle='#000'; g.fillRect(0,0,560,560); g.drawImage(glc, sx,sy,S,S, 0,0,560,560); return cv.toDataURL('image/png'); };1`);
for(const [nm,ck] of [['a',0],['b',1.5],['c',3.0]]){
  const url=await ev(`__grab(${ck})`);
  fs.writeFileSync(path.join(OUT,nm+'.png'), Buffer.from(url.split(',')[1],'base64')); }
await ev(`_previewClock=0; render(); 1`);
console.log('capturas en scratchpad/r247c/');
console.log('errs:',JSON.stringify(await ev(`window.__errs.slice(0,8)`)));
ws.close();
