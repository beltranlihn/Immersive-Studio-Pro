/* [R270] Captura del panel de inspector con varios efectos, para MIRAR el resultado (Beltran esta en el movil y
   no puede probar). Uso: node r270-captura.mjs <nombre-salida> */
import http from 'http'; import fs from 'fs';
const OUT='scratchpad/'+(process.argv[2]||'r270')+'.png';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const pg=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl&&/index\.html/.test(x.url));
const ws=new WebSocket(pg.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await ev(`(async()=>{ await newProject('dome',1024,1024,30,180,true); if(typeof hideLanding==='function')hideLanding(); })()`);
await wait(1500);
/* un clip con varios efectos reactivos distintos + un motion, que es la vista que Beltran describe */
const MODO=process.argv[3]||"react";
const info=await ev(`(function(){
  const process_modo=${JSON.stringify(MODO)};
  state.media.push({id:uid(),name:'clip.mp4',kind:'video',w:1920,h:1080,dur:20,fps:30,color:'#7A9E7E',path:'x',folder:null});
  const m=state.media[state.media.length-1];
  state.clips=[]; const c=makeClip(m,state.lanes.findIndex(l=>l.kind==='video'),0); c.dur=10; state.clips.push(c);
  state.selId=c.id; state.selIds=[c.id];
  const tipos=Object.keys(FXBY).slice(0,4);
  c.fx=[]; for(const ty of tipos){ addFxToClip(c,ty,false); }
  /* una automatizacion en uno de ellos, para ver el rombo encendido y la etiqueta resaltada */
  if(c.fx[0]){ const k=fxKey(c.fx[0],'int'); c.kf=c.kf||{}; c.kf[k]=[{t:0,v:20,e:'linear'},{t:5,v:90,e:'linear'}]; }
  renderInspector();
  if(process_modo==='motion'){ const ti=document.querySelector('.instab[data-tab=insp]')||document.querySelectorAll('.instab')[0]; if(ti)ti.click();
    const tipos0=c.fx.map(f=>f.type); for(const ty of tipos0) addFxToClip(c,ty,true);
    const heads=[...document.querySelectorAll('.sechead')]; const mo=heads.find(h=>/Motion/i.test(h.textContent)); if(mo)mo.click(); }
  else { const tb=document.querySelector('.instab[data-tab=react]'); if(tb)tb.click(); }
  return { efectos:c.fx.map(f=>f.type) }; })()`);
await wait(1200);
console.log('efectos en la tarjeta: '+info.efectos.join(', '));
/* se despliega el panel del inspector y se recorta la captura a el */
const rect=await ev(`(function(){ const el=document.querySelector('#inspPane')||document.querySelector('.insbody');
  if(!el)return null; const r=el.getBoundingClientRect(); return {x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)}; })()`);
if(!rect){ console.log('*** no se encontro el panel'); process.exit(1); }
const shot=await cmd('Page.captureScreenshot',{format:'png',clip:{x:rect.x,y:rect.y,width:rect.w,height:rect.h,scale:1.6}});
fs.writeFileSync(OUT, Buffer.from(shot.data,'base64'));
console.log('captura: '+OUT+'  ('+rect.w+'x'+rect.h+' a escala 1,6)');
ws.close();
