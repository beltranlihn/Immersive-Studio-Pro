/* [R249] El arrastre de verdad: agarrar la imagen del monitor con el raton y soltarla en una pista. */
import http from 'http'; import fs from 'fs'; import path from 'path';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const raton=(type,x,y)=>cmd('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1,pointerType:'mouse'});

await cmd('Page.enable'); await cmd('Page.reload',{ignoreCache:true}); await wait(3500);
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e))); return 1; })()`);
await ev(`state.dirty=false;1`);
await ev(`(async()=>{ await newProject('dome',2048,2048,60,180,true); })()`); await wait(1000);
await ev(`(function(){ if(typeof hideLanding==='function')hideLanding(); resize(); render(); return 1; })()`); await wait(300);

/* un video real del material de Beltran */
const RAIZ='C:\\Users\\beltr\\Desktop\\Alma Digital Studio';
function buscaVideo(dir,prof){ if(prof>4)return null;
  let ent=[]; try{ ent=fs.readdirSync(dir,{withFileTypes:true}); }catch(e){ return null; }
  for(const e of ent){ if(e.isFile()&&/\.(mp4|mov|m4v)$/i.test(e.name)){ const p2=path.join(dir,e.name); if(fs.statSync(p2).size>2e6)return p2; } }
  for(const e of ent){ if(e.isDirectory()){ const r=buscaVideo(path.join(dir,e.name),prof+1); if(r)return r; } }
  return null; }
const VID=buscaVideo(RAIZ,0);
if(!VID){ console.log('no encontre video en '+RAIZ); ws.close(); process.exit(0); }
console.log('material: '+path.basename(VID));

await ev(`window.__addVid=function(ruta,nombre){ return new Promise(res=>{
  const url=DSP.toFileURL(ruta); const v=document.createElement('video'); v.preload='metadata'; v.src=url;
  v.addEventListener('loadedmetadata',()=>{ const m={id:uid(),name:nombre,kind:'video',el:v,originalEl:v,srcUrl:url,tex:newTex(),
      w:v.videoWidth,h:v.videoHeight,dur:v.duration,fps:30,thumb:null,color:clipColorFor('video'),proxyReady:false,proxyPct:0,
      path:ruta,fsize:0,folder:null,missing:false,_loading:false};
    state.media.push(m); renderMedia(); res({n:nombre,dur:+m.dur.toFixed(2),w:m.w,h:m.h}); });
  v.addEventListener('error',()=>res(null)); }); };1`);
const info=await ev(`__addVid(${JSON.stringify(VID)},${JSON.stringify(path.basename(VID))})`);
if(!info){ console.log('el video no cargo'); ws.close(); process.exit(0); }
console.log('   '+info.w+'x'+info.h+'  '+info.dur+' s');


const geo=await ev(`(function(){ if(_srcMon)closeSourceMonitor(); state.clips=[];
  const m=state.media.find(x=>x.kind==='video'); if(!m)return {err:'sin video'};
  m.srcIn=20; m.srcOut=26.5;                                  // 6,5 s de un archivo de 50
  openSourceMonitor(m);
  _srcMonX=520; _srcMonY=80; const el=document.querySelector('#srcMon'); el.style.left='520px'; el.style.top='80px';
  renderTimeline();
  const pic=el.querySelector('.smpic').getBoundingClientRect();
  const lane=document.querySelector('#tracks .lane'); const lr=lane.getBoundingClientRect();
  return { pic:{x:pic.left+pic.width/2,y:pic.top+pic.height/2},
           lane:{x:lr.left+180,y:lr.top+lr.height/2, idx:+lane.dataset.lane},
           marcado:+(m.srcOut-m.srcIn).toFixed(2), durArchivo:+m.dur.toFixed(2), clips:state.clips.length }; })()`);
if(geo.err){ console.log(geo.err); ws.close(); process.exit(0); }
console.log('marcado '+geo.marcado+' s de un archivo de '+geo.durArchivo+' s');
console.log('arrastro la imagen ('+Math.round(geo.pic.x)+','+Math.round(geo.pic.y)+') → pista '+geo.lane.idx+' ('+Math.round(geo.lane.x)+','+Math.round(geo.lane.y)+')');
await raton('mousePressed',geo.pic.x,geo.pic.y); await wait(70);
for(let i=1;i<=10;i++){ await raton('mouseMoved', geo.pic.x+(geo.lane.x-geo.pic.x)*i/10, geo.pic.y+(geo.lane.y-geo.pic.y)*i/10); await wait(40); }
const fantasma=await ev(`document.querySelectorAll('.moveghost').length`);
await raton('mouseReleased',geo.lane.x,geo.lane.y); await wait(400);
const r=await ev(`(function(){ const c=state.clips[state.clips.length-1];
  return { clips:state.clips.length, inP:c?+(c.inP||0).toFixed(2):null, dur:c?+c.dur.toFixed(2):null,
           start:c?+c.start.toFixed(2):null, sigueSonando:!!(_srcMon&&_srcMon.playing) }; })()`);
console.log('fantasma en la pista al pasar : '+(fantasma?'si':'no'));
console.log('clip soltado                  : empieza en '+r.start+'s · inP '+r.inP+'s · dura '+r.dur+'s'
  +(Math.abs(r.dur-geo.marcado)<0.06?'   (SOLO el trozo marcado)':'   *** dura '+r.dur+', esperaba '+geo.marcado+' ***'));
console.log('el clic largo no lanzo play   : '+(r.sigueSonando?'*** se puso a reproducir ***':'correcto'));
const shot=await cmd('Page.captureScreenshot',{format:'png'});
fs.writeFileSync('scratchpad/r249-monitor.png', Buffer.from(shot.data,'base64'));
console.log('captura: scratchpad/r249-monitor.png');
ws.close();
