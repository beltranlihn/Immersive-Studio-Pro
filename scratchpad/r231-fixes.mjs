/* [R231] Verificación de la tanda de correcciones del 2026-07-30 (lista de Beltrán):
   A máscara (hover de arista + inserción en su sitio + paneo desbloqueado) · B landing (sin preajuste ni piso) ·
   C visor externo 2D (piso partido + zoom) · D colores de pista fijos · E audio a pistas de audio · F snap por eje.
   Uso: npx electron . --remote-debugging-port=9222   y luego   node scratchpad/r231-fixes.mjs                     */
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
  addEventListener('unhandledrejection',e=>__errs.push('rej: '+String((e.reason&&e.reason.message)||e.reason)));
  const ce=console.error; console.error=function(){ try{__errs.push('con: '+[...arguments].map(String).join(' '));}catch(_){} return ce.apply(console,arguments); };
  try{ localStorage.removeItem('ispRoomVp'); }catch(_){} return 1; })()`);

/* ---------- B · landing: ni preajuste ni piso por defecto ---------- */
out.B_landing = await ev(`(function(){ const S=lchInit();
  const html=lchPresetOptions(S); const m=html.match(/<option value="([^"]*)" selected>([^<]*)</);
  return { pisoPorDefecto:S.roomFloor, presetPorDefecto:S.roomPre, marcada:m?{v:m[1],label:m[2]}:null,
    tieneOpcionVacia:html.indexOf('<option value=""')===0 }; })()`);

/* ---------- demo de sala (con piso) ---------- */
await ev(`(async()=>{ try{ await startDemoProject('room'); }catch(e){ window.__d=String(e&&e.message||e); } })()`);
await wait(2400);
await ev(`(function(){ try{ if(typeof _tourStop==='function')_tourStop(); const o=document.getElementById('tourOv'); if(o)o.remove(); }catch(e){}
  const b=document.querySelector('#viewModeSeg button[data-v="2d"]'); if(b)b.click(); state.playhead=6; updModeUI(); resize(); renderTimeline(); return 1; })()`);
await wait(700);
out.demoErr = await ev(`window.__d||null`);

/* ---------- B2 · sala con piso ⇒ visor partido abierto al entrar ---------- */
out.B_autoFloor = await ev(`({ roomFloor:state.view.roomFloor, split:vpSplitOn(), floorOn:vpFloorOn(), paneles:vpPanels().length })`);

/* ---------- D · colores de pista fijos por función ---------- */
out.D_colores = await ev(`(function(){ const q=k=>{ const l=state.lanes.find(x=>k==='floor'?x.surf==='floor':(k==='audio'?x.kind==='audio':(x.kind==='video'&&x.surf!=='floor'))); return l?laneColor(l):null; };
  const hd=document.querySelector('.lanehdr.floor'); const tag=hd?hd.querySelector('.tag.floor'):null;
  const cs=tag?getComputedStyle(tag):null;
  return { video:q('video'), audio:q('audio'), floor:q('floor'),
    tagFloorColor:cs?cs.color:null, tagFloorBorde:cs?cs.borderTopColor:null,
    quedaColorPersonalizado:state.lanes.some(l=>l.color!=null),
    menuTieneColorDePista:(function(){ const hd2=document.querySelector('.lanehdr'); if(!hd2)return 'sin cabecera';
      let txt=''; const om=window.openMenu; window.openMenu=(x,y,items)=>{ txt=items.filter(i=>i&&i.label).map(i=>i.label).join(' | '); };
      try{ hd2.oncontextmenu({preventDefault(){},clientX:10,clientY:10}); } finally { window.openMenu=om; }
      return /colour|color/i.test(txt)?txt:false; })() }; })()`);

/* ---------- E · el audio de un vídeo sólo va a pistas de audio ---------- */
/* El audio de un clip de vídeo comparte medio (kind 'video') con su pareja de imagen: lo que decide su destino
   tiene que ser la PISTA donde vive, no el medio. Se comprueba la misma expresión que usa onTLMove. */
out.E_audio = await ev(`(function(){ const li=state.lanes.findIndex(l=>l.kind==='audio'), lv=state.lanes.findIndex(l=>l.kind==='video');
  if(li<0||lv<0)return {sinPistas:true};
  const falso={id:-999,lane:li,mediaId:'-',start:0,dur:2,props:{},link:'x1'};
  state.clips.push(falso);
  const destino=m=>(isAudioClip(falso)||(m&&m.kind==='audio'))?'audio':'video';
  const r={ enPistaDeAudio:isAudioClip(falso), audioDeUnVideo_va_a:destino({kind:'video'}), audioPuro_va_a:destino({kind:'audio'}) };
  falso.lane=lv; r.clipDeVideo_va_a=destino({kind:'video'});
  state.clips.pop(); return r; })()`);

/* ---------- F · snap: misma zona de captura en los dos ejes ---------- */
out.F_snap = await ev(`(function(){ const c=state.clips.find(x=>{const l=state.lanes[x.lane];return l&&l.surf==='wall';});
  if(!c)return {sinClip:true}; const CP=clipPanel(c), M=flatMap(CP), SR=clipSurfRect(c);
  const pxX=snapThr(CP,'x')*(M.z*M.sx*CP.w/2), pxY=snapThr(CP,'y')*(M.z*M.sy*CP.h/2); // umbral llevado a px de PANTALLA
  const viejoX=0.018*(M.z*M.sx*CP.w/2), viejoY=0.018*(M.z*M.sy*CP.h/2);
  const sY=roomSeamY(SR), sX=roomSeamX(SR);
  const casi=0.018*0.5; // medio umbral viejo por encima del centro vertical del lienzo (costura y=0)
  return { capturaX_px:+pxX.toFixed(2), capturaY_px:+pxY.toFixed(2),
    antes_capturaX_px:+viejoX.toFixed(2), antes_capturaY_px:+viejoY.toFixed(2),
    costurasY:sY.map(v=>+v.toFixed(3)), costurasX_n:sX.length,
    pegaCentroVertical:snapMoveAxis(casi,0.2,sY,false,CP,'y')===0,
    pegaBordeSuperior:Math.abs(snapMoveAxis(1-casi,0.0,sY,false,CP,'y')-1)<1e-9,
    altIgnora:snapMoveAxis(casi,0.2,sY,true,CP,'y')===casi }; })()`);

/* ---------- A · máscara: hover de arista, inserción en su sitio, paneo libre ---------- */
out.A_mask = await ev(`(function(){ const c=state.clips.find(x=>{const l=state.lanes[x.lane];return l&&l.surf==='wall';});
  if(!c)return {sinClip:true};
  state.selId=c.id; state.selIds=[c.id]; state.playhead=Math.max(c.start+0.1,state.playhead);
  if(state.playhead>=c.start+c.dur)state.playhead=c.start+0.1;
  /* el clip tiene que medir algo en PANTALLA: con un polígono de 5 px la tolerancia del vértice (9 px) se lo
     traga todo y el clic acaba arrastrando un punto en vez de insertar — artefacto del sondeo, no del código */
  Object.assign(c.props,{x:0,y:0,scale:60,rot:0});
  c.penMasks=[{pts:[[0.2,0.2],[0.8,0.2],[0.8,0.8],[0.2,0.8]],feather:0,invert:false,on:true}]; c._penSel=0;
  startMaskEdit(c,0); render();
  const mk=c.penMasks[0], m=mediaById(c.mediaId), t=state.playhead;
  const a=penPtPix(c,m,t,mk.pts[2]), b=penPtPix(c,m,t,mk.pts[3]);
  if(!a||!b)return {sinProyeccion:true};
  const mx=(a[0]+b[0])/2, my=(a[1]+b[1])/2;                     // punto medio de la arista 2→3
  const g=gridc, r=g.getBoundingClientRect();
  const ptr=(tipo,x,y,extra)=>g.dispatchEvent(new PointerEvent(tipo,Object.assign({clientX:r.left+x,clientY:r.top+y,button:0,buttons:1,bubbles:true,pointerId:1},extra||{})));
  ptr('pointermove',mx,my); const hov={hay:!!_maskHover,si:_maskHover?_maskHover.si:null,cursor:g.style.cursor};
  const c0=penPtPix(c,m,t,mk.pts[0]), c2=penPtPix(c,m,t,mk.pts[2]);
  const centro=[(c0[0]+c2[0])/2,(c0[1]+c2[1])/2];                // dentro del polígono, lejos de toda arista
  ptr('pointermove',centro[0],centro[1]); const hovVacio={hay:!!_maskHover,cursor:g.style.cursor};
  ptr('pointermove',mx,my);
  const n0=mk.pts.length;
  ptr('pointerdown',mx,my); ptr('pointerup',mx,my); const n1=mk.pts.length;   // sobre la arista → inserta en su sitio
  ptr('pointerdown',centro[0],centro[1]); ptr('pointerup',centro[0],centro[1]); const n2=mk.pts.length; // en el vacío → nada
  const medio=maskEditPointerDown({button:1,shiftKey:false},mx,my); // botón central → lo cede al paneo
  const conShift=maskEditPointerDown({button:0,shiftKey:true},mx,my);
  const res={ hoverArista:hov, hoverEnElVacio:hovVacio,
    puntos_antes:n0, tras_clic_en_arista:n1, tras_clic_en_vacio:n2,
    insertoUno:(n1===n0+1), orden:mk.pts.map(q=>[+q[0].toFixed(2),+q[1].toFixed(2)]),
    botonCentralCedido:(medio===false), shiftCedido:(conShift===false) };
  endMaskEdit(true); c.penMasks=[]; delete c._penSel; vpFit(); render(); return res; })()`);

/* ---------- C · visor externo 2D: se parte según SU botón, y tiene encuadre propio ---------- */
out.C_visor = await ev(`(function(){ const bak=_vPaint;
  const con=(function(){ _vPaint=true; _vFloor=true; const r={split:vpSplitOn(),floor:vpFloorOn(),paneles:vpPanels().length}; _vPaint=bak; return r; })();
  const sin=(function(){ _vPaint=true; _vFloor=false; const r={split:vpSplitOn(),paneles:vpPanels().length}; _vPaint=bak; _vFloor=true; return r; })();
  const propio=(function(){ _vPaint=true; const s=vpState('wall'); const mismo=(s===((state.view.vp||{}).wall)); _vPaint=bak; return {compartidoConElEditor:mismo}; })();
  const z0=vVpState(null).zoom; vVpState(null).zoom=3.1; const z1=vVpState(null).zoom; vVpState(null).zoom=z0;
  return { conFloor:con, sinFloor:sin, encuadre:propio, zoomEscribible:(z1===3.1), hayHelper:(typeof vWithViewport==='function') }; })()`);

/* ---------- el 3D y el export no se han movido ---------- */
await ev(`(function(){ const b=document.querySelector('#viewModeSeg button[data-v="3d"]'); if(b)b.click(); return 1; })()`); await wait(800);
out.en3D = await ev(`({ paneles:vpPanels().length, split:vpSplitOn() })`);
await ev(`(function(){ const b=document.querySelector('#viewModeSeg button[data-v="2d"]'); if(b)b.click(); return 1; })()`); await wait(400);

{ const {data}=await cmd('Page.captureScreenshot',{format:'png'});
  const fs=await import('fs'), os=await import('os'), path=await import('path');
  const dir=(process.env.ISP_SHOTS||path.join(os.tmpdir(),'isp-r231')); try{fs.mkdirSync(dir,{recursive:true});}catch(_){}
  fs.writeFileSync(path.join(dir,'r231-timeline.png'),Buffer.from(data,'base64')); out.shot=path.join(dir,'r231-timeline.png'); }

out.errs = await ev(`window.__errs.slice(0,20)`);
console.log(JSON.stringify(out,null,1));
ws.close();
