/* [R276b] Foto del mando FOV en el visor 3D del domo (modo Viewer), donde estaba el ultimo puntito blanco.
   Entra al modo por el MISMO camino que el usuario -clic en los botones- para que la captura sea real. */
import http from 'http'; import fs from 'fs';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`);
await wait(1600);
/* 3D, y dentro de 3D el modo Viewer: los dos por clic. */
const entrada=await ev(`(function(){
  const b3=[...document.querySelectorAll('button')].find(b=>/^\\s*3D\\s*$/.test(b.textContent));
  if(b3)b3.click(); else return 'no hay boton 3D';
  const seg=document.querySelector('#threeModeSeg');
  const bv=seg?[...seg.querySelectorAll('button')].find(b=>b.dataset.m==='spec'):null;
  if(!bv)return 'no hay boton Viewer';
  bv.click(); return 'ok'; })()`);
console.log('entrada al visor: '+entrada);
await wait(900);

const st=await ev(`(function(){ const c=document.querySelector('#fovCtl');
  if(!c)return {falta:true};
  const vis=getComputedStyle(c).display;
  const r=c.getBoundingClientRect();
  return {vis, x:Math.round(r.left), y:Math.round(r.top), w:Math.round(r.width), h:Math.round(r.height),
          valor:document.querySelector('#fovRange').value, pct:document.querySelector('#fovRange').style.getPropertyValue('--pct')}; })()`);
console.log('fovCtl: '+JSON.stringify(st));
if(st.falta||st.vis==='none'){ console.log('*** el mando no esta a la vista; no hay nada que fotografiar'); process.exit(1); }
if(!st.pct){ console.log('*** OJO: --pct vacio -> la pista se pintaria al 50 % por defecto, no al valor real'); }

/* Zoom sobre la zona del mando, con holgura, para que se vea el detalle. */
const M=26;
const shot=await cmd('Page.captureScreenshot',{format:'png',clip:{x:Math.max(0,st.x-M),y:Math.max(0,st.y-M),width:st.w+M*2,height:st.h+M*2,scale:6}});
fs.writeFileSync('scratchpad/r276b-fov.png', Buffer.from(shot.data,'base64'));
/* Y la barra entera, para verlo en contexto. */
const barra=await ev(`(function(){ const c=document.querySelector('#fovCtl'); let e=c; while(e&&e.getBoundingClientRect().width<600)e=e.parentElement;
  const r=(e||c).getBoundingClientRect(); return {x:Math.max(0,Math.round(r.left)),y:Math.max(0,Math.round(r.top)),w:Math.round(r.width),h:Math.round(r.height)}; })()`);
const shot2=await cmd('Page.captureScreenshot',{format:'png',clip:{x:barra.x,y:barra.y,width:barra.w,height:Math.min(barra.h,60),scale:2.5}});
fs.writeFileSync('scratchpad/r276b-barra.png', Buffer.from(shot2.data,'base64'));
console.log('capturas: r276b-fov.png (zoom x6) y r276b-barra.png');
ws.close();
