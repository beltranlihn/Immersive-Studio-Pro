/* [R233] Las condiciones REALES de Beltrán: sala SIN piso (tira 7196x912) y zoom ~1000%.
   Se muestrea una columna que cruza el borde INFERIOR y otra que cruza el IZQUIERDO, con LINEAR y con NEAREST. */
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

/* SIN PISO y muros de 1799x912 → tira 7196x912, la sala de la captura */
await ev(`(function(){ const as=activeSeq();
  const cfg={ walls: as.room.walls.map((w,i)=>({role:w.role,order:i+1,wcm:w.wcm,hcm:w.hcm,pxW:1799,pxH:912})), floor:null, fps:60 };
  applyRoomGeometry(cfg); return 1; })()`); await wait(600);

out.lienzo = await ev(`({w:state.seqW,h:state.seqH,piso:!!activeSeq().room.floor})`);
out.uv = await ev(`(function(){ const A=(state.seqW||1)/(state.seqH||1), s=Math.min(2/A,2), Fx=s*A/2, Fy=s/2, K=2*Fx/Math.max(1,(state.seqW||1));
  const uOf=px=>((K*px-Fx)*0.5+0.5), vOf=py=>((Fy-K*py)*0.5+0.5); const P=vpPanels()[0];
  return { u:[+uOf(P.rx0).toFixed(6),+uOf(P.rx1).toFixed(6)], v:[+vOf(P.ry1).toFixed(6),+vOf(P.ry0).toFixed(6)],
    lateralesEnElBorde:(Math.abs(uOf(P.rx0))<1e-9&&Math.abs(uOf(P.rx1)-1)<1e-9),
    verticalesInteriores:(vOf(P.ry1)>1e-6&&vOf(P.ry0)<1-1e-6), texel:1/compSize, compSize }; })()`);

/* clip que cubre TODO, bien claro para que cualquier mezcla con negro se note */
await ev(`(function(){ const c=state.clips.find(x=>{const l=state.lanes[x.lane];return l&&l.surf==='wall';});
  state.selId=c.id; state.selIds=[c.id];
  if(state.playhead<c.start||state.playhead>=c.start+c.dur)state.playhead=c.start+0.1;
  Object.assign(c.props,{x:0,y:0,rot:0,scale:600}); delete c.props.maskWalls; c.penMasks=[];
  for(const o of state.clips){ if(o!==c) o.props.scale=0.01; }
  return 1; })()`);

/* muestrea una columna (borde inferior) y una fila (borde izquierdo) alrededor del borde del marco */
await ev(`window.__perfil=function(){ const P=vpPanels()[0], M=flatMap(P); const dpr=glc.width/Math.max(1,view.cw);
  const cv=document.createElement('canvas'); cv.width=glc.width; cv.height=glc.height; const g2=cv.getContext('2d'); g2.drawImage(glc,0,0);
  const leer=(x,y)=>{ const d=g2.getImageData(Math.round(x),Math.round(y),1,1).data; return [d[0],d[1],d[2],d[3]]; };
  const abajo=M.px(0,-1), izq=M.px(-1,0);
  const col=[]; for(let dy=-6;dy<=2;dy++)col.push({dy,rgba:leer(abajo[0]*dpr, abajo[1]*dpr+dy)});
  const fil=[]; for(let dx=-2;dx<=6;dx++)fil.push({dx,rgba:leer(izq[0]*dpr+dx, izq[1]*dpr)});
  return {yAbajo:+(abajo[1]*dpr).toFixed(1), xIzq:+(izq[0]*dpr).toFixed(1), columnaBordeInferior:col, filaBordeIzquierdo:fil}; };1`);

const zoom=async z=>ev(`(function(){ const st=vpState('wall'); st.zoom=${z}; st.pan=[-0.98,-0.98]; render(); return {zoom:st.zoom}; })()`);
const filtro=async f=>ev(`(function(){ gl.bindTexture(gl.TEXTURE_2D,compTex);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.${f}); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.${f});
  gl.bindTexture(gl.TEXTURE_2D,null); render(); return 1; })()`);

await zoom(10); await wait(300);
await filtro('LINEAR');  out.zoom10_LINEAR  = await ev(`__perfil()`);
await filtro('NEAREST'); out.zoom10_NEAREST = await ev(`__perfil()`);
await filtro('LINEAR');

out.errs = await ev(`window.__errs.slice(0,10)`);
console.log(JSON.stringify(out,null,1));
ws.close();
