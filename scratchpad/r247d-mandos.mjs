/* [R247d] Comprueba que cada mando nuevo hace lo que dice, y captura las composiciones que Beltran describio:
   dos lineas sueltas, tejido apretado, tejido con huecos, lineas paralelas quietas, invertido.
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
  state.view.showGrid=false; state.view.showOutline=false; state.view.hfade=false; state.motionPreview=true;
  state.view.zoom=1; state.view.pan=[0,0]; resize(); render(); return 1; })()`); await wait(400);

await ev(`window.__opacas=function(){ state.media=state.media.filter(m=>m.kind!=='image');
  const mk=(nombre,W,H,color)=>{ const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
    const x=cv.getContext('2d'); x.fillStyle=color; x.fillRect(0,0,W,H);
    const r=Math.min(W,H)*0.33; x.strokeStyle='rgba(255,255,255,.55)'; x.lineWidth=Math.max(2,Math.min(W,H)*0.02); x.beginPath(); x.arc(W/2,H/2,r,0,7); x.stroke(); // circulo tenue: sigue delatando deformacion sin fingir un borde
    const m={id:uid(),kind:'image',name:nombre,el:cv,originalEl:cv,tex:newTex(),w:W,h:H,dur:10,fps:0,color,missing:false,_loading:false};
    upTex(m.tex,cv); try{m.thumb=cv.toDataURL();}catch(e){} state.media.push(m); return m; };
  mk('1x1',512,512,'#7FD4FF'); mk('16x9',960,540,'#FFB37F'); mk('9x16',540,960,'#C8A2FF');
  mk('4x3',640,480,'#9BE59B'); mk('1x1b',512,512,'#FF9BC4'); mk('3x2',720,480,'#E8E07F');
  renderMedia(); return state.media.filter(m=>m.kind==='image').map(m=>m.id); };
window.__grab=function(clock){ _previewClock=clock; render();
  const S=Math.min(glc.width,glc.height), sx=Math.round((glc.width-S)/2), sy=Math.round((glc.height-S)/2);
  const cv=document.createElement('canvas'); cv.width=cv.height=440; const g=cv.getContext('2d');
  g.fillStyle='#000'; g.fillRect(0,0,440,440); g.drawImage(glc, sx,sy,S,S, 0,0,440,440); return cv.toDataURL('image/png'); };
window.__monta=function(cfg){ state.clips=[]; state.media=state.media.filter(m=>m.kind!=='nest');
  const ids=__opacas();
  const nest=createComposition(Object.assign({kind:'weave',mediaIds:ids},cfg));
  state.playhead=1; renderTimeline(); render();
  if(!nest)return {err:1};
  const cs=nest.nestClips;
  const dirs=cs.map(c=>{ const a=c.anim&&c.anim[0]; return a?Math.sign(a.speed):0; });
  const anchos=[...new Set(cs.map(c=>Math.round(c.props.scale*100)/100))].sort((a,b)=>a-b);
  return { clips:cs.length,
           conMov:dirs.filter(d=>d!==0).length, adelante:dirs.filter(d=>d>0).length, atras:dirs.filter(d=>d<0).length,
           entrelazados:cs.filter(c=>c.props.weaveCells).length,
           ejes:[...new Set(cs.map(c=>c.anim&&c.anim[0]&&c.anim[0].param).filter(Boolean))].sort(),
           anchos:anchos.slice(0,4) }; };1`);

const OUT=path.join(process.cwd(),'scratchpad','r247d');
fs.rmSync(OUT,{recursive:true,force:true}); fs.mkdirSync(OUT,{recursive:true});

const casos=[
 ['tejido-lleno',  {bands:5,weaveMode:'weave',bandW:100,fit:'across',density:1,speed:0.10,speedV:0.10,motion:'alternate',interlace:true}],
 ['tejido-huecos', {bands:5,weaveMode:'weave',bandW:55, fit:'across',density:1,speed:0.10,speedV:0.10,motion:'alternate',interlace:true}],
 ['tejido-finas',  {bands:12,weaveMode:'weave',bandW:80,fit:'across',density:1,speed:0.10,speedV:0.10,motion:'alternate',interlace:true}],
 ['dos-lineas',    {bands:2,weaveMode:'h',    bandW:30, fit:'along', density:1,speed:0.12,motion:'same',interlace:false}],
 ['lineas-quietas',{bands:6,weaveMode:'v',    bandW:60, fit:'across',density:1,speed:0.12,motion:'still',interlace:false}],
 ['dos-velocidad', {bands:5,weaveMode:'weave',bandW:100,fit:'across',density:1,speed:0.05,speedV:0.30,motion:'same',interlace:true}],
 ['invertido',     {bands:5,weaveMode:'weave',bandW:100,fit:'across',density:1,speed:0.10,speedV:0.10,motion:'same',flip:true,interlace:true}],
];
for(const [nombre,cfg] of casos){
  const r=await ev(`__monta(${JSON.stringify(cfg)})`); await wait(450);
  const url=await ev(`__grab(1.2)`);
  fs.writeFileSync(path.join(OUT,nombre+'.png'), Buffer.from(url.split(',')[1],'base64'));
  console.log(nombre.padEnd(16)+' clips '+String(r.clips).padStart(4)+
              '  mov '+String(r.conMov).padStart(4)+' (→'+r.adelante+' ←'+r.atras+')'+
              '  entrelazados '+String(r.entrelazados).padStart(3)+
              '  ejes '+JSON.stringify(r.ejes)+'  anchos '+JSON.stringify(r.anchos));
}
await ev(`_previewClock=0; state.view.zoom=0.92; render(); 1`);
console.log('errs:',JSON.stringify(await ev(`window.__errs.slice(0,8)`)));
ws.close();
