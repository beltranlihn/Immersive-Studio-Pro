/* [R235] Paneo 1:1 en los dos ejes + medida de la resolución real del composite en una tira de sala. */
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
await ev(`state.dirty=false;1`);
await ev(`(async()=>{try{await startDemoProject('room');}catch(e){window.__d=String(e);}})()`); await wait(2600);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){}
 document.querySelector('#viewModeSeg button[data-v="2d"]').click(); resize(); return 1;})()`); await wait(700);
/* la sala de Beltrán: 7196x912 sin piso */
await ev(`(function(){ const as=activeSeq();
  applyRoomGeometry({walls:as.room.walls.map((w,i)=>({role:w.role,order:i+1,wcm:w.wcm,hcm:w.hcm,pxW:1799,pxH:912})),floor:null,fps:60}); return 1; })()`); await wait(700);

/* ---------- 1 · el paneo mueve el contenido 1:1 en los dos ejes ---------- */
out.pan = await ev(`(function(){ const P=vpPanels()[0], st=vpState(P.surf); st.zoom=4; st.pan=[0,0]; render();
  const M=flatMap(P);
  const antesX=M.px(0,0)[0], antesY=M.px(0,0)[1];   // dónde cae el centro del marco en pantalla
  const el=gridc, r=el.getBoundingClientRect();
  const ptr=(tipo,x,y,ex)=>el.dispatchEvent(new PointerEvent(tipo,Object.assign({clientX:r.left+x,clientY:r.top+y,button:0,buttons:1,bubbles:true,pointerId:1},ex||{})));
  const x0=P.x+P.w/2, y0=P.h/2, D=80;
  ptr('pointerdown',x0,y0,{shiftKey:true});          // shift = paneo
  ptr('pointermove',x0+D,y0+D,{shiftKey:true});
  ptr('pointerup',x0+D,y0+D,{buttons:0});
  const M2=flatMap(P); const dx=M2.px(0,0)[0]-antesX, dy=M2.px(0,0)[1]-antesY;
  return { arrastre:[D,D], movioX:+dx.toFixed(1), movioY:+dy.toFixed(1),
    ratioX:+(dx/D).toFixed(3), ratioY:+(dy/D).toFixed(3),
    ambos1a1:(Math.abs(dx/D-1)<0.05 && Math.abs(dy/D-1)<0.05) }; })()`);

/* ---------- 2 · resolución REAL del composite para esta tira ---------- */
out.resolucion = await ev(`(function(){ const A=(state.seqW||1)/(state.seqH||1);
  const bandaAlto=compSize/A, bandaAncho=compSize;
  return { lienzo:[state.seqW,state.seqH], aspecto:+A.toFixed(2), compSize, COMP,
    texelsBanda:[Math.round(bandaAncho),Math.round(bandaAlto)],
    submuestreoH:+(state.seqW/bandaAncho).toFixed(2), submuestreoV:+(state.seqH/bandaAlto).toFixed(2),
    texelesUsados:Math.round(bandaAncho*bandaAlto), texelesTotales:compSize*compSize,
    desperdicio:+(1-(bandaAncho*bandaAlto)/(compSize*compSize)).toFixed(3) }; })()`);

out.errs = await ev(`window.__errs.slice(0,10)`);
console.log(JSON.stringify(out,null,1));
ws.close();
