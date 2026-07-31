/* [R233] Perfil del borde inferior, barriendo en coordenadas de MARCO para no fallar el punto. */
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
/* calidad de previsualización a tope, para separar "poca resolución" de "sangrado del borde" */
out.calidad = await ev(`(function(){ const antes=compSize; setCompSize(COMP); return {antes, ahora:compSize, COMP}; })()`);

await ev(`(function(){ const c=state.clips.find(x=>{const l=state.lanes[x.lane];return l&&l.surf==='wall';});
  state.selId=c.id; state.selIds=[c.id];
  if(state.playhead<c.start||state.playhead>=c.start+c.dur)state.playhead=c.start+0.1;
  Object.assign(c.props,{x:0,y:0,rot:0,scale:900}); delete c.props.maskWalls; c.penMasks=[];
  for(const o of state.clips){ if(o!==c) o.props.scale=0.01; }
  return 1; })()`);

/* barrido en coordenadas de MARCO: fy de -1.02 (fuera) a -0.90 (dentro), en el centro horizontal */
await ev(`window.__barrido=function(){ const P=vpPanels()[0], M=flatMap(P); const dpr=glc.width/Math.max(1,view.cw);
  const cv=document.createElement('canvas'); cv.width=glc.width; cv.height=glc.height; const g2=cv.getContext('2d'); g2.drawImage(glc,0,0);
  const leer=(x,y)=>{ x=Math.round(x); y=Math.round(y); if(x<0||y<0||x>=cv.width||y>=cv.height)return null;
    const d=g2.getImageData(x,y,1,1).data; return [d[0],d[1],d[2],d[3]]; };
  const filas=[];
  for(let k=-12;k<=24;k++){ const fy=-1+k*0.005; const q=M.px(0,fy);
    filas.push({fy:+fy.toFixed(3), pxLienzo:+(((fy+1)/2)*state.seqH).toFixed(1), rgba:leer(q[0]*dpr,q[1]*dpr)}); }
  return filas; };1`);

const zoom=async z=>ev(`(function(){ const st=vpState('wall'); st.zoom=${z}; st.pan=[0,-0.97]; render(); return st.zoom; })()`);
const filtro=async f=>ev(`(function(){ gl.bindTexture(gl.TEXTURE_2D,compTex);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.${f}); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.${f});
  gl.bindTexture(gl.TEXTURE_2D,null); render(); return 1; })()`);

await zoom(10); await wait(350);
out.zoomAplicado = await ev(`vpState('wall').zoom`);
await filtro('LINEAR');  out.LINEAR  = await ev(`__barrido()`);
await filtro('NEAREST'); out.NEAREST = await ev(`__barrido()`);
await filtro('LINEAR');

out.errs = await ev(`window.__errs.slice(0,10)`);
console.log(JSON.stringify(out));
ws.close();
