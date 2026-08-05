/* [R271] Captura del cuadro de composicion tal y como esta HOY, para que Beltran lo vea desde el movil antes de
   rehacerlo. Uso: node r271-compose-foto.mjs <salida> <tipo> */
import http from 'http'; import fs from 'fs';
const OUT='scratchpad/'+(process.argv[2]||'compose')+'.png', KIND=process.argv[3]||'tunnel';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`);
await wait(1500);
await ev(`(function(){ for(let k=0;k<3;k++) state.media.push({id:uid(),name:'clip'+(k+1)+'.mp4',kind:'video',w:1920,h:1080,dur:12,fps:30,color:'#7A9E7E',path:'x'+k,folder:null}); renderMedia(); return 1; })()`);
await wait(400);
await ev(`(function(){ const ids=state.media.filter(m=>m.kind==='video').map(m=>m.id);
  openCompose(${JSON.stringify(KIND)},null,null,null,ids); return 1; })()`);
await wait(800);
const rect=await ev(`(function(){ const ov=document.querySelector('#composeOv')||document.querySelector('.ovl')||document.querySelector('[id^=comp]');
  const caja=ov?(ov.querySelector('.card')||ov.querySelector('div')||ov):null;
  const el=caja||ov; if(!el)return null; const r=el.getBoundingClientRect();
  return {x:Math.max(0,Math.round(r.left)),y:Math.max(0,Math.round(r.top)),w:Math.round(r.width),h:Math.round(r.height)}; })()`);
if(!rect||rect.w<100){ console.log('*** no se encontro el cuadro (rect='+JSON.stringify(rect)+')'); process.exit(1); }
const shot=await cmd('Page.captureScreenshot',{format:'png',clip:{x:rect.x,y:rect.y,width:rect.w,height:rect.h,scale:1.5}});
fs.writeFileSync(OUT, Buffer.from(shot.data,'base64'));
console.log('captura: '+OUT+'  ('+rect.w+'x'+rect.h+')');
ws.close();
