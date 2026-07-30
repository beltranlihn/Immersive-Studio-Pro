/* [R231] La máscara por la ruta REAL del DOM: hover sobre una arista (marca + cursor) e inserción en su sitio. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const out={};
await ev(`window.__errs=window.__errs||[];1`);

out.r = await ev(`(function(){ const c=state.clips.find(x=>{const l=state.lanes[x.lane];return l&&l.surf==='wall';});
  if(!c)return {sinClip:true};
  state.selId=c.id; state.selIds=[c.id];
  if(state.playhead<c.start||state.playhead>=c.start+c.dur)state.playhead=c.start+0.1;
  Object.assign(c.props,{x:0,y:0,scale:60,rot:0});
  c.penMasks=[{pts:[[0.2,0.2],[0.8,0.2],[0.8,0.8],[0.2,0.8]],feather:0,invert:false,on:true}]; c._penSel=0;
  startMaskEdit(c,0); render();
  const mk=c.penMasks[0], m=mediaById(c.mediaId), t=state.playhead;
  const P=i=>penPtPix(c,m,t,mk.pts[i]);
  const a=P(2), b=P(3); const mx=(a[0]+b[0])/2, my=(a[1]+b[1])/2; // arista 2→3 (borde inferior), sin tocar
  const el=gridc, r=el.getBoundingClientRect();
  const ptr=(tipo,x,y,extra)=>el.dispatchEvent(new PointerEvent(tipo,Object.assign({clientX:r.left+x,clientY:r.top+y,button:0,buttons:1,bubbles:true,pointerId:1},extra||{})));

  ptr('pointermove',mx,my);                                   // hover sobre la arista
  const hov={ hay:!!_maskHover, si:_maskHover?_maskHover.si:null, cursor:el.style.cursor };
  const centro=P(0).map((v,i)=>(P(0)[i]+P(2)[i])/2);          // centro del polígono
  ptr('pointermove',centro[0],centro[1]);                     // hover en el vacío → sin marca
  const hovVacio={ hay:!!_maskHover, cursor:el.style.cursor };
  ptr('pointermove',mx,my);                                   // vuelve a la arista

  const n0=mk.pts.length;
  ptr('pointerdown',mx,my); ptr('pointerup',mx,my);           // clic REAL sobre la arista
  const n1=mk.pts.length;
  const orden=mk.pts.map(q=>[+q[0].toFixed(2),+q[1].toFixed(2)]);

  const n2=mk.pts.length;
  ptr('pointerdown',centro[0],centro[1]); ptr('pointerup',centro[0],centro[1]); // clic en el vacío
  const n3=mk.pts.length;

  /* botón central sobre la arista: tiene que PANEAR, no tocar la máscara */
  const panAntes=[...vpState(clipPanel(c).surf).pan]; const nAntes=mk.pts.length;
  ptr('pointerdown',mx,my,{button:1,buttons:4});
  const paneando=!!(typeof vdrag!=='undefined'&&vdrag&&vdrag.mode==='pan');
  ptr('pointermove',mx+40,my,{button:1,buttons:4}); ptr('pointerup',mx+40,my,{button:1,buttons:0});
  const panDespues=[...vpState(clipPanel(c).surf).pan];
  const res={ hoverEnArista:hov, hoverEnVacio:hovVacio,
    antes:n0, trasClicEnArista:n1, insertoUno:(n1===n0+1), orden,
    vacio_antes:n2, vacio_despues:n3, vacioNoAnade:(n2===n3),
    botonCentralPanea:paneando, panCambio:(panAntes[0]!==panDespues[0]), mascaraIntacta:(mk.pts.length===nAntes) };
  endMaskEdit(true); c.penMasks=[]; delete c._penSel; vpFit(); render(); return res; })()`);

out.errs = await ev(`window.__errs.slice(0,20)`);
console.log(JSON.stringify(out,null,1));
ws.close();
