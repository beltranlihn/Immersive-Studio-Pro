/* [R247] Graba el tejido en movimiento, con fuentes de PROPORCIONES DISTINTAS a proposito (1:1, 16:9, 9:16, 4:3)
   para que se vea que ninguna sale estirada. Tres tomas: tejido con el lado largo cruzando la tira, el mismo con
   el lado largo a lo largo, y solo-un-sentido. Sin acentos graves dentro de las plantillas. */
import http from 'http';
import fs from 'fs';
import path from 'path';
const PORT=process.argv[2]||9222;
const FPS=25, SEGS=6;
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
  state.view.showGrid=false; state.view.showOutline=false; state.view.hfade=false; state.motionPreview=true; resize(); render(); return 1; })()`); await wait(400);

/* fuentes con proporciones MUY distintas y un patron interno que delata cualquier estiramiento:
   un circulo inscrito — si el clip se deforma, el circulo sale ovalado y se ve a la legua */
await ev(`window.__fuentes=function(){
  state.media=state.media.filter(m=>m.kind!=='image');
  const mk=(nombre,W,H,color)=>{ const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
    const x=cv.getContext('2d'); x.fillStyle=color; x.fillRect(0,0,W,H);
    x.strokeStyle='rgba(0,0,0,.75)'; x.lineWidth=Math.max(3,Math.min(W,H)*0.05); x.strokeRect(0,0,W,H);
    const r=Math.min(W,H)*0.34; x.beginPath(); x.arc(W/2,H/2,r,0,7); x.strokeStyle='rgba(0,0,0,.75)'; x.stroke();
    const m={id:uid(),kind:'image',name:nombre,el:cv,originalEl:cv,tex:newTex(),w:W,h:H,dur:10,fps:0,color,missing:false,_loading:false};
    upTex(m.tex,cv); try{m.thumb=cv.toDataURL();}catch(e){} state.media.push(m); return m; };
  mk('1x1',512,512,'#7FD4FF'); mk('16x9',960,540,'#FFB37F'); mk('9x16',540,960,'#C8A2FF'); mk('4x3',640,480,'#9BE59B');
  renderMedia(); return state.media.filter(m=>m.kind==='image').map(m=>m.id); };1`);

await ev(`window.__grab=function(clock){ _previewClock=clock; render();
  const S=Math.min(glc.width,glc.height), sx=Math.round((glc.width-S)/2), sy=Math.round((glc.height-S)/2);
  const cv=document.createElement('canvas'); cv.width=cv.height=480; const g=cv.getContext('2d');
  g.fillStyle='#000'; g.fillRect(0,0,480,480); g.drawImage(glc, sx,sy,S,S, 0,0,480,480);
  return cv.toDataURL('image/png'); };1`);

async function toma(nombre,cfg){
  const dir=path.join(process.cwd(),'scratchpad','r247-'+nombre);
  fs.rmSync(dir,{recursive:true,force:true}); fs.mkdirSync(dir,{recursive:true});
  const info=await ev(`(function(){ state.clips=[]; state.media=state.media.filter(m=>m.kind!=='nest');
    const ids=__fuentes();
    const nest=createComposition(Object.assign({kind:'weave',mediaIds:ids},${JSON.stringify(cfg)}));
    state.playhead=1; state.view.showGrid=false; renderTimeline(); render();
    return { n:nest?nest.nestClips.length:0 }; })()`);
  await wait(600);
  const N=FPS*SEGS;
  for(let i=0;i<N;i++){ const url=await ev(`__grab(${(i/FPS).toFixed(4)})`);
    fs.writeFileSync(path.join(dir,'f'+String(i).padStart(4,'0')+'.png'), Buffer.from(url.split(',')[1],'base64')); }
  console.log(nombre+': '+info.n+' elementos, '+N+' fotogramas');
  return dir;
}

await toma('cruzando',{bands:5,perBand:6,weaveMode:'weave',fit:'across',speed:0.10,alternate:true});
await toma('alolargo',{bands:5,perBand:5,weaveMode:'weave',fit:'along',speed:0.10,alternate:true});
await toma('unsentido',{bands:6,perBand:6,weaveMode:'h',fit:'across',speed:0.12,alternate:true});

await ev(`_previewClock=0; render(); 1`);
console.log('errs:',JSON.stringify(await ev(`window.__errs.slice(0,8)`)));
ws.close();
