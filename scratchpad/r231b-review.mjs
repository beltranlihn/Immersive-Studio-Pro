/* [R231b] Los cinco hallazgos de la revisión del diff de R231. */
import http from 'http';
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const p=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&p.has(m.id)){p.get(m.id)(m);p.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;p.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const out={};
await ev(`(function(){ window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message||e)));
  const ce=console.error; console.error=function(){ try{__errs.push('con: '+[...arguments].map(String).join(' '));}catch(_){} return ce.apply(console,arguments); };
  try{ localStorage.removeItem('ispRoomVp'); }catch(_){} return 1; })()`);

await ev(`(async()=>{ try{ await startDemoProject('room'); }catch(e){ window.__d=String(e); } })()`); await wait(2400);
await ev(`(function(){ try{ if(typeof _tourStop==='function')_tourStop(); const o=document.getElementById('tourOv'); if(o)o.remove(); }catch(e){}
  const b=document.querySelector('#viewModeSeg button[data-v="2d"]'); if(b)b.click(); state.playhead=6; updModeUI(); resize(); renderTimeline(); return 1; })()`); await wait(700);

/* ---------- 3 · roomVpAutoFloor NO pisa la preferencia guardada ---------- */
out.f3_prefIntacta = await ev(`(function(){ state.view.roomFloor=false; saveRoomVpPrefs();          // el usuario dejó el piso oculto
  const guardadoAntes=localStorage.getItem('ispRoomVp');
  roomVpAutoFloor(true);                                                                            // abrir una sala con piso
  const guardadoDespues=localStorage.getItem('ispRoomVp');
  const r={ memoriaForzadaATrue:(state.view.roomFloor===true), guardadoAntes, guardadoDespues,
    preferenciaSobrevive:(guardadoAntes===guardadoDespues) };
  state.view.roomFloor=true; saveRoomVpPrefs(); return r; })()`);

/* ---------- 1 · botón DERECHO en modo máscara: ni mueve el clip ni añade puntos ---------- */
out.f1_derecho = await ev(`(function(){ const c=state.clips.find(x=>{const l=state.lanes[x.lane];return l&&l.surf==='wall';});
  state.selId=c.id; state.selIds=[c.id];
  if(state.playhead<c.start||state.playhead>=c.start+c.dur)state.playhead=c.start+0.1;
  Object.assign(c.props,{x:0,y:0,scale:60,rot:0});
  c.penMasks=[{pts:[[0.2,0.2],[0.8,0.2],[0.8,0.8],[0.2,0.8]],feather:0,invert:false,on:true}]; c._penSel=0;
  startMaskEdit(c,0); render();
  const mk=c.penMasks[0], m=mediaById(c.mediaId), t=state.playhead;
  const a=penPtPix(c,m,t,mk.pts[0]), b=penPtPix(c,m,t,mk.pts[1]);
  const dentro=[(a[0]+b[0])/2,(a[1]+b[1])/2+18]; // dentro del clip, lejos de la arista
  const el=gridc, r=el.getBoundingClientRect();
  const ptr=(tipo,x,y,extra)=>el.dispatchEvent(new PointerEvent(tipo,Object.assign({clientX:r.left+x,clientY:r.top+y,button:0,buttons:1,bubbles:true,pointerId:1},extra||{})));
  const x0=c.props.x, y0=c.props.y, n0=mk.pts.length;
  ptr('pointerdown',dentro[0],dentro[1],{button:2,buttons:2});
  const arrastreTrasDerecho=(typeof vdrag!=='undefined'&&vdrag)?vdrag.mode:null;
  ptr('pointermove',dentro[0]+60,dentro[1],{button:2,buttons:2}); ptr('pointerup',dentro[0]+60,dentro[1],{button:2,buttons:0});
  const r1={ tragadoPorLaMascara:(maskEditPointerDown({button:2,shiftKey:false},dentro[0],dentro[1])===true),
    vdragTrasDerecho:arrastreTrasDerecho, clipQuieto:(c.props.x===x0&&c.props.y===y0), puntosIgual:(mk.pts.length===n0) };
  /* y el CENTRAL sigue paneando y apaga el fantasma */
  ptr('pointermove',(a[0]+b[0])/2,(a[1]+b[1])/2);      // hover sobre la arista → hay fantasma
  r1.hoverAntesDelPaneo=!!_maskHover;
  ptr('pointerdown',(a[0]+b[0])/2,(a[1]+b[1])/2,{button:1,buttons:4});
  r1.centralPanea=!!(typeof vdrag!=='undefined'&&vdrag&&vdrag.mode==='pan');
  r1.hoverApagadoAlPanear=!_maskHover;
  ptr('pointermove',(a[0]+b[0])/2+40,(a[1]+b[1])/2,{button:1,buttons:4}); ptr('pointerup',(a[0]+b[0])/2+40,(a[1]+b[1])/2,{button:1,buttons:0});
  return r1; })()`);

/* ---------- 5 · el hover no repinta en cada píxel ---------- */
out.f5_repintados = await ev(`(function(){ const c=clipById(state.selId); const mk=c.penMasks[0], m=mediaById(c.mediaId), t=state.playhead;
  vpFit(); render();
  const a=penPtPix(c,m,t,mk.pts[0]), b=penPtPix(c,m,t,mk.pts[1]);
  const el=gridc, r=el.getBoundingClientRect();
  const mv=(x,y)=>el.dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+x,clientY:r.top+y,button:0,buttons:0,bubbles:true,pointerId:1}));
  const x0=(a[0]+b[0])/2, y0=(a[1]+b[1])/2;
  mv(x0,y0); // primer hover (asienta la firma)
  const orig=window.render; let n=0; window.render=function(){ n++; return orig.apply(this,arguments); };
  for(let i=1;i<=8;i++)mv(x0+i,y0+(b[1]-a[1])/(b[0]-a[0])*i); // 8 pasos de 1 px a lo largo de la arista
  const conCuantizado=n;
  window.render=orig;
  return { movimientos:8, repintados:conCuantizado, menosQueUnoPorEvento:(conCuantizado<8) }; })()`);
await ev(`(function(){ const c=clipById(state.selId); if(c){ endMaskEdit(true); c.penMasks=[]; delete c._penSel; } vpFit(); render(); return 1; })()`);

/* ---------- 2 · la firma de la barra del visor lleva la secuencia activa y su piso ---------- */
out.f2_barra = await ev(`(function(){ try{ openViewerWindow(); }catch(e){ return {noAbre:String(e)}; } return 1; })()`);
await wait(1400);
out.f2_firma = await ev(`(function(){ const sig=_vBarSig||'';
  return { firma:sig, llevaSecuenciaActiva:sig.indexOf(String(state.activeSeqId))>=0,
    hayPisoEnLaFirma:/\\|[01]\\|/.test(sig), abierto:viewerOpen() }; })()`);
await ev(`(function(){ try{ if(_viewerWin&&!_viewerWin.closed)_viewerWin.close(); }catch(e){} return 1; })()`);
await wait(500);

out.errs = await ev(`window.__errs.slice(0,20)`);
console.log(JSON.stringify(out,null,1));
ws.close();
