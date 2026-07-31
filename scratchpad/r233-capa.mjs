/* [R233] ¿La línea negra es contenido GL (glc) o una GUÍA 2D (gridc)? Se muestrean las dos capas por separado. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out={};
await ev(`window.__errs=[];addEventListener('error',e=>__errs.push(String(e.message||e)));localStorage.removeItem('ispRoomVp');1`);
await ev(`(async()=>{try{await startDemoProject('room');}catch(e){window.__d=String(e);}})()`); await wait(2500);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){}
 document.querySelector('#viewModeSeg button[data-v="2d"]').click(); resize(); return 1;})()`); await wait(600);
await ev(`(function(){ const as=activeSeq();
  const cfg={ walls: as.room.walls.map((w,i)=>({role:w.role,order:i+1,wcm:w.wcm,hcm:w.hcm,pxW:1799,pxH:912})), floor:null, fps:60 };
  applyRoomGeometry(cfg); return 1; })()`); await wait(600);

/* ¿hay zona muerta? stripH vs pxH de cada muro */
out.geometria = await ev(`(function(){ const as=activeSeq(), r=as.room;
  return { lienzo:[as.w,as.h], stripH:r.stripH, muros:r.walls.map(w=>({role:w.role,pxW:w.pxW,pxH:w.pxH,x0:w.x0,x1:w.x1})),
    hayZonaMuerta:r.walls.some(w=>w.pxH<r.stripH) }; })()`);

await ev(`(function(){ const c=state.clips.find(x=>{const l=state.lanes[x.lane];return l&&l.surf==='wall';});
  state.selId=c.id; state.selIds=[c.id];
  if(state.playhead<c.start||state.playhead>=c.start+c.dur)state.playhead=c.start+0.1;
  Object.assign(c.props,{x:0,y:0,rot:0,scale:900}); delete c.props.maskWalls; c.penMasks=[];
  for(const o of state.clips){ if(o!==c) o.props.scale=0.01; }
  const st=vpState('wall'); st.zoom=10; st.pan=[0,-0.97]; render(); return 1; })()`); await wait(400);

/* barrido de las DOS capas por separado */
await ev(`window.__capas=function(){ const P=vpPanels()[0], M=flatMap(P);
  const dg=glc.width/Math.max(1,view.cw), dr=gridc.width/Math.max(1,view.cw);
  const cvA=document.createElement('canvas'); cvA.width=glc.width; cvA.height=glc.height; const gA=cvA.getContext('2d'); gA.drawImage(glc,0,0);
  const cvB=document.createElement('canvas'); cvB.width=gridc.width; cvB.height=gridc.height; const gB=cvB.getContext('2d'); gB.drawImage(gridc,0,0);
  const pick=(g,cv,x,y)=>{ x=Math.round(x); y=Math.round(y); if(x<0||y<0||x>=cv.width||y>=cv.height)return null;
    const d=g.getImageData(x,y,1,1).data; return [d[0],d[1],d[2],d[3]]; };
  const filas=[];
  for(let k=-6;k<=14;k++){ const fy=-1+k*0.004; const q=M.px(0,fy);
    filas.push({ fy:+fy.toFixed(3), pxLienzo:+(((fy+1)/2)*state.seqH).toFixed(1),
      GL:pick(gA,cvA,q[0]*dg,q[1]*dg), guias:pick(gB,cvB,q[0]*dr,q[1]*dr) }); }
  return filas; };1`);
out.capas = await ev(`(function(){ render(); return __capas(); })()`);

/* y el mismo barrido con TODAS las superposiciones apagadas */
out.sinGuias = await ev(`(function(){ const g=state.view.showGrid, s=state.view.showSeam, o=state.view.showOutline;
  state.view.showGrid=false; state.view.showSeam=false; state.view.showOutline=false; render();
  const r=__capas(); state.view.showGrid=g; state.view.showSeam=s; state.view.showOutline=o; render(); return r; })()`);

out.errs = await ev(`window.__errs.slice(0,10)`);
console.log(JSON.stringify(out));
ws.close();
