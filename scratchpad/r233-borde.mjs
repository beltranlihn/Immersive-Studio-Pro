/* [R233] ¿De dónde sale la línea negra del borde del lienzo en sala 360?
   Experimento decisivo: el MISMO fotograma con el composite en LINEAR y en NEAREST. */
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
 document.querySelector('#viewModeSeg button[data-v="2d"]').click(); resize(); renderTimeline(); return 1;})()`); await wait(700);

/* ---------- geometría: ¿dónde cae el contenido dentro del composite CUADRADO? ---------- */
out.uv = await ev(`(function(){ const A=(state.seqW||1)/(state.seqH||1), s=Math.min(2/A,2), Fx=s*A/2, Fy=s/2, K=2*Fx/Math.max(1,(state.seqW||1));
  const uOf=px=>((K*px-Fx)*0.5+0.5), vOf=py=>((Fy-K*py)*0.5+0.5);
  const P=vpPanels()[0];
  return { lienzo:[state.seqW,state.seqH], compEsCuadrado:true, compAspect:+A.toFixed(3),
    panel:{surf:P.surf,rx0:P.rx0,rx1:P.rx1,ry0:P.ry0,ry1:P.ry1},
    u:[+uOf(P.rx0).toFixed(6),+uOf(P.rx1).toFixed(6)],
    v:[+vOf(P.ry1).toFixed(6),+vOf(P.ry0).toFixed(6)],
    /* si u toca 0 y 1 exactos, CLAMP_TO_EDGE protege los laterales; si v NO los toca, arriba/abajo sangran */
    lateralesEnElBorde:(Math.abs(uOf(P.rx0))<1e-9&&Math.abs(uOf(P.rx1)-1)<1e-9),
    verticalesInteriores:(vOf(P.ry1)>1e-6&&vOf(P.ry0)<1-1e-6) }; })()`);

/* ---------- un clip que cubra TODO el lienzo, en blanco ---------- */
await ev(`(function(){ const c=state.clips.find(x=>{const l=state.lanes[x.lane];return l&&l.surf==='wall';});
  state.selId=c.id; state.selIds=[c.id];
  if(state.playhead<c.start||state.playhead>=c.start+c.dur)state.playhead=c.start+0.1;
  Object.assign(c.props,{x:0,y:0,rot:0,scale:400}); delete c.props.maskWalls; c.penMasks=[];
  // el resto de clips fuera de en medio
  for(const o of state.clips){ if(o!==c) o.props.scale=0.01; }
  vpFit(); render(); return 1; })()`);
await wait(400);

/* ---------- muestreo de una columna que cruza el BORDE INFERIOR del contenido ---------- */
await ev(`window.__columna=function(){ const M=flatMap(vpPanels()[0]);
  const dpr=glc.width/Math.max(1,view.cw);
  const cx=Math.round(M.px(0,0)[0]*dpr);              // centro horizontal del marco
  const yBorde=M.px(0,-1)[1]*dpr;                     // borde INFERIOR del marco, en px de glc
  const cv=document.createElement('canvas'); cv.width=glc.width; cv.height=glc.height;
  const cx2=cv.getContext('2d'); cx2.drawImage(glc,0,0);
  const y0=Math.max(0,Math.round(yBorde)-14), y1=Math.min(glc.height-1,Math.round(yBorde)+3);
  const d=cx2.getImageData(cx,y0,1,y1-y0+1).data; const filas=[];
  for(let i=0;i<=y1-y0;i++)filas.push({dy:(y0+i)-Math.round(yBorde), rgba:[d[i*4],d[i*4+1],d[i*4+2],d[i*4+3]]});
  return {yBorde:+yBorde.toFixed(1), filas}; };1`);

out.conLINEAR = await ev(`(function(){ render(); return __columna(); })()`);

/* ---------- el mismo fotograma con NEAREST ---------- */
out.conNEAREST = await ev(`(function(){ gl.bindTexture(gl.TEXTURE_2D,compTex);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.bindTexture(gl.TEXTURE_2D,null); render(); const r=__columna();
  gl.bindTexture(gl.TEXTURE_2D,compTex);                    // se deja como estaba
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.bindTexture(gl.TEXTURE_2D,null); render(); return r; })()`);

out.veredicto = await ev(`(function(){ const L=${JSON.stringify(null)}; return 1; })()`);
out.errs = await ev(`window.__errs.slice(0,10)`);
console.log(JSON.stringify(out,null,1));
ws.close();
