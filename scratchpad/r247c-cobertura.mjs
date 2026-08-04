/* [R247c] Aisla GEOMETRIA de CONTENIDO: fuentes opacas generadas, con un circulo inscrito que delata cualquier
   estiramiento. Si con estas no queda ni un pixel negro dentro del disco, los huecos de la prueba con material real
   son el alfa de los PNG, no un fallo del reparto. De paso compara tres cantidades de ojo de pez.
   Sin acentos graves dentro de las plantillas. */
import http from 'http';
import fs from 'fs';
import path from 'path';
const PORT=process.argv[2]||9222;
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:PORT,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:120000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

await cmd('Page.enable'); await cmd('Page.reload',{ignoreCache:true}); await wait(3500);
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e))); return 1; })()`);
await ev(`state.dirty=false;1`);
await ev(`(async()=>{ await newProject('dome',2048,2048,60,180,true); })()`); await wait(900);
await ev(`(function(){ const b=document.querySelector('#viewModeSeg button[data-v="2d"]'); if(b)b.click();
  state.view.showGrid=false; state.view.showOutline=false; state.view.hfade=false; state.motionPreview=true; resize(); render(); return 1; })()`); await wait(400);

await ev(`window.__fuentes=function(){
  state.media=state.media.filter(m=>m.kind!=='image');
  const mk=(nombre,W,H,color)=>{ const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
    const x=cv.getContext('2d'); x.fillStyle=color; x.fillRect(0,0,W,H);
    x.strokeStyle='rgba(0,0,0,.8)'; x.lineWidth=Math.max(3,Math.min(W,H)*0.06); x.strokeRect(0,0,W,H);
    const r=Math.min(W,H)*0.33; x.beginPath(); x.arc(W/2,H/2,r,0,7); x.stroke();   // circulo: si sale ovalado, hay deformacion
    const m={id:uid(),kind:'image',name:nombre,el:cv,originalEl:cv,tex:newTex(),w:W,h:H,dur:10,fps:0,color,missing:false,_loading:false};
    upTex(m.tex,cv); try{m.thumb=cv.toDataURL();}catch(e){} state.media.push(m); return m; };
  mk('1x1',512,512,'#7FD4FF'); mk('16x9',960,540,'#FFB37F'); mk('9x16',540,960,'#C8A2FF');
  mk('4x3',640,480,'#9BE59B'); mk('1x1b',512,512,'#FF9BC4'); mk('3x2',720,480,'#E8E07F');
  renderMedia(); return state.media.filter(m=>m.kind==='image').map(m=>m.id); };1`);

/* cuenta pixeles NEGROS dentro del disco: la medida honesta de si el reparto deja huecos */
await ev(`window.__negros=function(){ const S=Math.min(glc.width,glc.height), sx=(glc.width-S)/2, sy=(glc.height-S)/2;
  const cv=document.createElement('canvas'); cv.width=cv.height=400; const g=cv.getContext('2d');
  g.drawImage(glc, sx,sy,S,S, 0,0,400,400); const d=g.getImageData(0,0,400,400).data;
  let dentro=0, negro=0;
  for(let y=0;y<400;y++)for(let x=0;x<400;x++){ const dx=x-199.5, dy=y-199.5; if(dx*dx+dy*dy>185*185)continue; // margen: el ojo de pez encoge el borde
    dentro++; const i=(y*400+x)*4; if(d[i]<12&&d[i+1]<12&&d[i+2]<12)negro++; }
  return { dentro, negro, pct:+(negro/dentro*100).toFixed(2) }; };1`);

await ev(`window.__grab=function(clock,px){ _previewClock=clock; render();
  const S=Math.min(glc.width,glc.height), sx=Math.round((glc.width-S)/2), sy=Math.round((glc.height-S)/2);
  const cv=document.createElement('canvas'); cv.width=cv.height=px||560; const g=cv.getContext('2d');
  g.fillStyle='#000'; g.fillRect(0,0,cv.width,cv.height); g.drawImage(glc, sx,sy,S,S, 0,0,cv.width,cv.height); return cv.toDataURL('image/png'); };1`);

const OUT=path.join(process.cwd(),'scratchpad','r247c');
fs.mkdirSync(OUT,{recursive:true});

async function toma(nombre,cfg,instantes){
  const info=await ev(`(function(){ state.clips=[]; state.media=state.media.filter(m=>m.kind!=='nest');
    const ids=__fuentes();
    const nest=createComposition(Object.assign({kind:'weave',mediaIds:ids},${JSON.stringify(cfg)}));
    state.playhead=1; renderTimeline(); render();
    return { clips:nest?nest.nestClips.length:0 }; })()`);
  await wait(700);
  await ev(`__grab(0)`);
  const neg=await ev(`__negros()`);
  for(const ck of instantes){ const url=await ev(`__grab(${ck})`);
    fs.writeFileSync(path.join(OUT,nombre+'-'+String(ck).replace('.','_')+'.png'), Buffer.from(url.split(',')[1],'base64')); }
  console.log(nombre.padEnd(16)+' clips '+String(info.clips).padStart(4)+'   negro dentro del disco: '+neg.pct+'%');
}

await toma('op-fish35', {bands:5,weaveMode:'weave',fit:'across',density:1.0,speed:0.10,alternate:true,interlace:true,fish:35},[0,1.5,3.0]);
await toma('op-fish0',  {bands:5,weaveMode:'weave',fit:'across',density:1.0,speed:0.10,alternate:true,interlace:true,fish:0},[0]);
await toma('op-fish70', {bands:5,weaveMode:'weave',fit:'across',density:1.0,speed:0.10,alternate:true,interlace:true,fish:70},[0]);
await toma('op-sinentr',{bands:5,weaveMode:'weave',fit:'across',density:1.0,speed:0.10,alternate:true,interlace:false,fish:35},[0]);
await toma('op-along',  {bands:5,weaveMode:'weave',fit:'along', density:1.0,speed:0.10,alternate:true,interlace:true,fish:35},[0]);

await ev(`_previewClock=0; render(); 1`);
console.log('errs:',JSON.stringify(await ev(`window.__errs.slice(0,8)`)));
ws.close();
