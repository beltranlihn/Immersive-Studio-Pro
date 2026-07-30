/* [R230b] Verificación de las correcciones que salieron de la revisión del visor partido.
   Uso: npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r230b-fixes.mjs             */
import http from 'http'; import fs from 'fs'; import os from 'os'; import path from 'path';
const SHOTS=(process.env.ISP_SHOTS||path.join(os.tmpdir(),'isp-r230b'))+path.sep;
try{ fs.mkdirSync(SHOTS,{recursive:true}); }catch(_){}
const t=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:9222,path:'/json/list'},r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res(JSON.parse(b)));}).on('error',rej);});
const page=t.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);
const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const pend=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}};
const cmd=(m,q={})=>new Promise((res,rej)=>{const i=++id;pend.set(i,x=>x.error?rej(new Error(JSON.stringify(x.error))):res(x.result));ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async x=>{const r=await cmd('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const shot=async n=>{const{data}=await cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(SHOTS+n,Buffer.from(data,'base64'));};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

await ev(`window.__errs=[];addEventListener('error',e=>__errs.push(String(e.message||e)));
 addEventListener('unhandledrejection',e=>__errs.push('rej: '+String((e.reason&&e.reason.message)||e.reason)));
 const ce=console.error;console.error=function(){try{__errs.push('con: '+[...arguments].map(String).join(' '));}catch(_){}return ce.apply(console,arguments);};
 localStorage.removeItem('ispRoomVp'); 1`);
await ev(`window.__drag=function(x0,y0,x1,y1,o){o=o||{};const g=document.getElementById('grid'),r=g.getBoundingClientRect();
 const mk=(t,x,y)=>new PointerEvent(t,{clientX:r.left+x,clientY:r.top+y,button:0,buttons:1,bubbles:true,pointerId:1,shiftKey:!!o.shift,altKey:!!o.alt});
 g.dispatchEvent(mk('pointerdown',x0,y0));g.dispatchEvent(mk('pointermove',x1,y1));g.dispatchEvent(mk('pointerup',x1,y1));
 window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:1}));return 1;};1`);

await ev(`(async()=>{try{await startDemoProject('room');}catch(e){window.__d=String(e);}})()`); await wait(2500);
await ev(`(function(){try{if(typeof _tourStop==='function')_tourStop();const o=document.getElementById('tourOv');if(o)o.remove();}catch(e){}
 document.querySelector('#viewModeSeg button[data-v="2d"]').click(); state.playhead=6; resize(); renderTimeline(); return 1;})()`); await wait(700);

const out={};

// 1 · los botones +/− y el % obedecen al panel con el FOCO
out.zoomCtl = await ev(`(function(){ const ps=vpPanels(), fl=ps[1];
  __drag(fl.x+fl.w/2, fl.h/2, fl.x+fl.w/2, fl.h/2);                 // clic en el panel del piso → foco
  const z0=vpState('floor').zoom, w0=vpState('wall').zoom;
  $('#vzIn').click(); $('#vzIn').click();
  const z1=vpState('floor').zoom, w1=vpState('wall').zoom, lbl1=$('#vzReset').textContent;
  __drag(ps[0].x+ps[0].w/2, ps[0].h/2, ps[0].x+ps[0].w/2, ps[0].h/2); // clic en muros → foco
  const lbl2=$('#vzReset').textContent;
  $('#vzOut').click(); const w2=vpState('wall').zoom, z2=vpState('floor').zoom;
  return {focus:state.view.vpFocus, floor:[+z0.toFixed(3),+z1.toFixed(3),+z2.toFixed(3)],
    wall:[+w0.toFixed(3),+w1.toFixed(3),+w2.toFixed(3)], lblTrasZoomPiso:lbl1, lblTrasFocoMuro:lbl2}; })()`);

// 2 · Fit recentra TODOS los paneles (salida cuando uno se fue de encuadre)
out.fit = await ev(`(function(){ vpState('floor').pan=[9,9]; vpState('floor').zoom=7; vpState('wall').zoom=4;
  $('#vzReset').click();
  return {floor:vpState('floor'), wall:vpState('wall'), lbl:$('#vzReset').textContent}; })()`);

// 3 · con el piso oculto, un clip de piso NO se dibuja ni se agarra sobre los muros
out.floorHidden = await ev(`(function(){ const fc=state.clips.find(c=>(state.lanes[c.lane]||{}).surf==='floor');
  state.selId=fc.id; state.selIds=[fc.id]; Object.assign(fc.props,{x:0,y:0,scale:60,rot:0});
  document.querySelector('#dispSeg button[data-d="floor"]').click();      // ocultar el piso
  render();
  const P=clipPanel(fc); const hits=[]; const ps=vpPanels();
  for(let i=0;i<=10;i++)for(let j=0;j<=6;j++){ const x=ps[0].x+ps[0].w*i/10, y=ps[0].h*j/6; if(flatRectHit(fc,x,y))hits.push([Math.round(x),Math.round(y)]); }
  const r={panel:P, handles:_flatHandles, hitsSobreMuros:hits.length, mask:penFromPix(fc,mediaById(fc.mediaId),state.playhead,ps[0].x+10,10)};
  document.querySelector('#dispSeg button[data-d="floor"]').click(); render(); return r; })()`);
await shot('floor-hidden.png');

// 4 · la ventana solo-visor y las miniaturas del launcher NO se parten
out.secundarios = await ev(`(function(){ const antes=vpPanels().length;
  _vPaint=true; const enViewer=vpPanels().length; _vPaint=false;
  _lchShot=true; const enLauncher=vpPanels().length; _lchShot=false;
  return {editor:antes, ventanaVisor:enViewer, miniaturaLauncher:enLauncher, tras:vpPanels().length}; })()`);

// 5 · el divisor guarda UNA vez, al soltar
out.divSave = await ev(`(function(){ let n=0; const set=localStorage.setItem.bind(localStorage);
  localStorage.setItem=function(k,v){ if(k==='ispRoomVp')n++; return set(k,v); };
  const g=document.getElementById('grid'), r=g.getBoundingClientRect(), dvx=vpDivX();
  const mk=(t,x)=>new PointerEvent(t,{clientX:r.left+x,clientY:r.top+120,button:0,buttons:1,bubbles:true,pointerId:1});
  g.dispatchEvent(mk('pointerdown',dvx));
  for(let i=0;i<25;i++)g.dispatchEvent(mk('pointermove',dvx-i*4));
  g.dispatchEvent(mk('pointerup',dvx-100)); window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:1}));
  localStorage.setItem=set; return {escrituras:n, guardado:localStorage.getItem('ispRoomVp')}; })()`);

// 6 · el botón del piso sólo se ve donde la partición existe (no en 3D, no en salas legacy)
out.btnCoherente = await ev(`(function(){ const b=()=>{const x=document.querySelector('#dispSeg button[data-d="floor"]');return x.style.display!=='none';};
  updModeUI(); const en2D=b();
  document.querySelector('#viewModeSeg button[data-v="3d"]').click(); const en3D=b();
  document.querySelector('#viewModeSeg button[data-v="2d"]').click();
  const keep=state.lanes.map(l=>l.surf); state.lanes.forEach(l=>{delete l.surf;}); updModeUI(); const enLegacy=b();
  state.lanes.forEach((l,i)=>{if(keep[i])l.surf=keep[i];}); updModeUI();
  return {en2D, en3D, enLegacy, vuelta:b()}; })()`);

// 7 · el piso por defecto de "New sequence… → 360 Room" y de roomFloorDefault
out.pisoDefecto = await ev(`(function(){ const W=[{role:'Front',wcm:500,hcm:300,pxW:1920,pxH:1080},{role:'Right',wcm:400,hcm:300,pxW:1920,pxH:1080},
   {role:'Back',wcm:500,hcm:300,pxW:1920,pxH:1080},{role:'Left',wcm:400,hcm:300,pxW:1920,pxH:1080}];
  const raros=[[],[{role:'Front',wcm:0,hcm:0,pxW:0,pxH:0}],[{role:'Front',wcm:300,hcm:250,pxW:800,pxH:600}]];
  return {normal:roomFloorDefault(W), raros:raros.map(r=>roomFloorDefault(r))}; })()`);

// 8 · ventana diminuta: los dos paneles caben dentro del lienzo
out.angosto = await ev(`(function(){ const cw=view.cw, ch=view.ch; const out=[];
  for(const w of [60,90,140,400]){ view.cw=w; const ps=vpPanels();
    out.push({w, dentro: ps.every(P=>P.x>=0 && P.x+P.w<=w+0.001), rects: ps.map(P=>[Math.round(P.x),Math.round(P.w)])}); }
  view.cw=cw; view.ch=ch; resize(); return out; })()`);

// 9 · renombrar una pista de piso y CANCELAR no deja "F1 F1"
out.rename = await ev(`(function(){ const li=state.lanes.findIndex(l=>l.surf==='floor'); renameLane(li);
  const el=document.querySelector('#laneHeaders .lanehdr[data-lane="'+li+'"] .nm');
  const arranca=el.textContent;
  el.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); el.blur();
  const h=document.querySelector('#laneHeaders .lanehdr[data-lane="'+li+'"]');
  return {arrancaVacio:arranca==='', tras:h.innerText.replace(/\\s+/g,' ').trim(), name:state.lanes[li].name}; })()`);

out.errs = await ev(`window.__errs.slice(0,20)`);
console.log(JSON.stringify(out,null,1));
console.log('SHOTS',SHOTS);
ws.close();
