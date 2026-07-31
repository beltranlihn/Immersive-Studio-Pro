/* [R233b] (1) el borde sigue limpio, (2) las costuras interiores NO se congelan, (3) el 3D con el color del lienzo. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out={};
await ev(`window.__errs=[];addEventListener('error',e=>__errs.push(String(e.message||e)));
 const ce=console.error;console.error=function(){try{__errs.push('con: '+[...arguments].map(String).join(' '));}catch(_){}return ce.apply(console,arguments);};
 localStorage.removeItem('ispRoomVp');1`);
await ev(`(async()=>{try{await startDemoProject('room');}catch(e){window.__d=String(e);}})()`); await wait(2500);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){}
 document.querySelector('#viewModeSeg button[data-v="2d"]').click(); resize(); return 1;})()`); await wait(600);
/* sala SIN piso, la de Beltrán */
await ev(`(function(){ const as=activeSeq();
  applyRoomGeometry({walls:as.room.walls.map((w,i)=>({role:w.role,order:i+1,wcm:w.wcm,hcm:w.hcm,pxW:1799,pxH:912})),floor:null,fps:60}); return 1; })()`); await wait(600);
await ev(`(function(){ const c=state.clips.find(x=>{const l=state.lanes[x.lane];return l&&l.surf==='wall';});
  state.selId=c.id; state.selIds=[c.id];
  if(state.playhead<c.start||state.playhead>=c.start+c.dur)state.playhead=c.start+0.1;
  Object.assign(c.props,{x:0,y:0,rot:0,scale:900}); delete c.props.maskWalls; c.penMasks=[];
  for(const o of state.clips){ if(o!==c) o.props.scale=0.01; } return 1; })()`);

await ev(`window.__lee=function(fx,fy){ const P=vpPanels()[0], M=flatMap(P); const d=glc.width/Math.max(1,view.cw);
  const q=M.px(fx,fy); const cv=document.createElement('canvas'); cv.width=glc.width; cv.height=glc.height;
  const g=cv.getContext('2d'); g.drawImage(glc,0,0);
  const x=Math.round(q[0]*d), y=Math.round(q[1]*d); if(x<0||y<0||x>=cv.width||y>=cv.height)return null;
  const k=g.getImageData(x,y,1,1).data; return [k[0],k[1],k[2],k[3]]; };1`);

/* 1 · borde exterior limpio (sigue el arreglo de R233) */
out.bordeExterior = await ev(`(function(){ const st=vpState('wall'); st.zoom=10; st.pan=[0,-0.97]; render();
  return { fuera:__lee(0,-1.01), borde:__lee(0,-0.996), dentro:__lee(0,-0.95) }; })()`);

/* 2 · costura INTERIOR (piso oculto ⇒ el panel corta en stripH): no debe congelarse.
   Se hace con piso, que es cuando ry1 es interior al contenido. */
out.costuraInterior = await ev(`(function(){ const as=activeSeq();
  applyRoomGeometry({walls:as.room.walls.map((w,i)=>({role:w.role,order:i+1,wcm:w.wcm,hcm:w.hcm,pxW:1799,pxH:912})),
    floor:{wcm:500,dcm:400,pxW:1799,pxH:1799}, fps:60}); return 1; })()`);
await wait(700);
out.costura = await ev(`(function(){ const P=vpPanels().find(x=>x.surf==='wall')||vpPanels()[0];
  const st=vpState('wall'); st.zoom=10; st.pan=[0,-0.97]; render();
  const M=flatMap(P);
  /* el borde inferior del panel de MUROS es interior al lienzo (debajo va el piso): que NO sea una repetición
     congelada, sino contenido que varía */
  const a=__lee(0,-0.999), b=__lee(0,-0.99), c=__lee(0,-0.97);
  return { panel:{ry0:P.ry0,ry1:P.ry1,alturaLienzo:state.seqH}, esInterior:(P.ry1<state.seqH),
    justoEnElBorde:a, unPocoDentro:b, masDentro:c }; })()`);

/* 3 · 3D: el color de un muro debe coincidir con el del lienzo 2D */
out.color = await ev(`(function(){ const st=vpState('wall'); vpFit(); render();
  const dosD=__lee(-0.5,0);                              // color en el visor 2D
  document.querySelector('#viewModeSeg button[data-v="3d"]').click(); return {dosD}; })()`);
await wait(1000);
out.color3D = await ev(`(function(){ render();
  const cv=document.createElement('canvas'); cv.width=glc.width; cv.height=glc.height;
  const g=cv.getContext('2d'); g.drawImage(glc,0,0);
  const d=g.getImageData(0,0,cv.width,cv.height).data;
  /* el píxel más brillante del 3D: si el sombreado falso siguiera, seria < que el del 2D */
  let mx=[0,0,0,0], mxs=-1;
  for(let i=0;i<d.length;i+=4){ if(d[i+3]<200)continue; const s=d[i]+d[i+1]+d[i+2]; if(s>mxs){mxs=s;mx=[d[i],d[i+1],d[i+2],d[i+3]];} }
  return {masBrillante3D:mx}; })()`);
await ev(`(function(){ document.querySelector('#viewModeSeg button[data-v="2d"]').click(); return 1; })()`); await wait(400);

out.errs = await ev(`window.__errs.slice(0,15)`);
console.log(JSON.stringify(out,null,1));
ws.close();
