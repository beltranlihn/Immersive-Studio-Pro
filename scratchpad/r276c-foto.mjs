/* [R276c] Foto del inspector entero con las secciones desplegadas, para que se vean los mandos en contexto. */
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
await ev(`(function(){
  const m={id:uid(),name:'toma.mp4',kind:'video',w:1920,h:1080,dur:12,fps:30,color:'#7A9E7E',path:'p',folder:null};
  state.media.push(m); renderMedia();
  addClip(state.lanes[0].id,m.id,0,6);
  const cl=state.clips[state.clips.length-1];
  cl.props=cl.props||{}; cl.props.mask='circle'; cl.props.maskScale=1.15; cl.props.opacity=72; cl.props.blur=18;
  /* dos mascaras de puntos, para ver la lista y los parametros del panel «Add mask» */
  cl.penMasks=[{pts:[[0.30,0.30],[0.70,0.30],[0.70,0.70],[0.30,0.70]],feather:14,invert:false,on:true},
               {pts:[[0.10,0.10],[0.40,0.10],[0.40,0.40],[0.10,0.40]],feather:0,invert:true,on:true}];
  cl._penSel=0; cl.penExpand=1.0;
  state.selId=cl.id; state.selIds=[cl.id]; renderTimeline(); renderInspector(); return 1; })()`);
await wait(500);
/* desplegar; el clic alterna, asi que se comprueba y se deshace si fue al reves */
await ev(`(function(){ const n=()=>[...document.querySelectorAll('input[type=range]')].filter(e=>e.getBoundingClientRect().width>8).length;
  const a=n(), h=[...document.querySelectorAll('[data-sec]')]; h.forEach(x=>x.click());
  if(n()<a)h.forEach(x=>x.click()); return n(); })()`);
await wait(500);
const ids=await ev(`[...document.querySelectorAll('input[type=range]')].filter(e=>e.getBoundingClientRect().width>8).map(e=>e.id||e.className).join(', ')`);
console.log('mandos a la vista: '+ids);
const box=await ev(`(function(){ const e=document.querySelector('#inspPane')||document.querySelector('#insBody');
  const r=e.getBoundingClientRect(); return {x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)}; })()`);
const shot=await cmd('Page.captureScreenshot',{format:'png',clip:{x:box.x,y:box.y,width:box.w,height:box.h,scale:2.2}});
fs.writeFileSync('scratchpad/r276c-inspector.png', Buffer.from(shot.data,'base64'));
console.log('captura: scratchpad/r276c-inspector.png ('+box.w+'x'+box.h+')');
ws.close();
