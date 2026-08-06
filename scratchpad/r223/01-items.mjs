// [R223] verificación de los ítems 1-5, 7, 8
import { fn, shot, errs, close } from './lib.mjs';
const out = {};

// ---- montar el timeline: A (V1 0-6s, linkeado a audio) + B (V1 6-12s, linkeado) ----
out.build = await fn(`
  state.clips = []; state.markers = [];
  state.selId=null; state.selIds=[]; state.selLane=null; state.selMarkerId=null;
  const mA = state.media.find(m=>m.name==='Multimedia2.mp4'), mB = state.media.find(m=>m.name==='Multimedia3.mp4');
  addClip(mA, 0, 0);  const cA = state.clips[state.clips.length-1];
  addClip(mB, 0, 8);  const cB = state.clips[state.clips.length-1];
  cA.dur = 6; cB.start = 6; cB.dur = 6;
  // esperar a attachLinkedAudio (decodifica el audio del mp4)
  for(let i=0;i<120 && state.clips.length<4; i++) await new Promise(r=>setTimeout(r,150));
  // sincronizar las mitades de audio con la geometría que acabamos de fijar
  for(const c of state.clips){ if(c.avRole==='a'){ const p=linkPartner(c); if(p){ c.start=p.start; c.dur=p.dur; c.inP=p.inP||0; } } }
  renderTimeline(); render(); reschedAudio();
  window.__ids = {A:cA.id, B:cB.id, Aa:(linkPartner(cA)||{}).id, Ba:(linkPartner(cB)||{}).id};
  return {n:state.clips.length, ids:window.__ids,
    clips: state.clips.map(c=>({id:c.id,lane:c.lane,start:+c.start.toFixed(3),dur:+c.dur.toFixed(3),role:c.avRole||null})),
    lanes: state.lanes.map(l=>l.kind), buffers: state.media.map(m=>!!m.buffer)};
`, 180000);

// ---- ÍTEM 1: tinte de pistas de audio (fila + cabecera con clase .aud y color aplicado) ----
out.item1 = await fn(`
  const rows=[...document.querySelectorAll('#tracks .lane')].map(r=>({lane:+r.dataset.lane, aud:r.classList.contains('aud'), bg:getComputedStyle(r).backgroundColor}));
  const hdrs=[...document.querySelectorAll('.lanehdr')].map(h=>({lane:+h.dataset.lane, aud:h.classList.contains('aud')}));
  const tint=getComputedStyle(document.documentElement).getPropertyValue('--audio-tint').trim();
  return {tint, rows, hdrs, audioLaneIdx: state.lanes.map((l,i)=>l.kind==='audio'?i:-1).filter(i=>i>=0)};
`);

// ---- ÍTEM 2: swatches CUADRADOS (popup de pista `colorPopup` + fila inline `openMenu({swatches})` del clip) ----
out.item2 = await fn(`
  const measure=sel=>[...document.querySelectorAll(sel)].map(b=>{const r=b.getBoundingClientRect();
    return {t:b.title,w:+r.width.toFixed(1),h:+r.height.toFixed(1),sq:Math.abs(r.width-r.height)<0.6};}).filter(x=>x.w>0);
  // (a) pista → "Set track color…" → colorPopup
  closeMenu&&closeMenu(); document.querySelectorAll('.lanecolpop').forEach(m=>m.remove());
  openLaneColorPopup(0, 200, 300);
  await new Promise(r=>setTimeout(r,120));
  const trackSw=measure('.lanecolpop button');
  document.querySelectorAll('.lanecolpop').forEach(m=>m.remove());
  // (b) clip → menú contextual (fila inline de swatches)
  const {A}=window.__ids; const cd=document.querySelector('.clip[data-clip="'+A+'"]');
  const r0=cd.getBoundingClientRect();
  cd.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:r0.left+20,clientY:r0.top+8}));
  await new Promise(r=>setTimeout(r,140));
  const clipSw=measure('.menu button[title]');
  closeMenu&&closeMenu();
  return {trackSw:{n:trackSw.length, sample:trackSw.slice(0,3), allSquare:trackSw.length>0&&trackSw.every(x=>x.sq)},
          clipSw:{n:clipSw.length, sample:clipSw.slice(0,3), allSquare:clipSw.length>0&&clipSw.every(x=>x.sq)}};
`);
out.item2_shot = await fn(`
  document.querySelectorAll('.lanecolpop').forEach(m=>m.remove()); closeMenu&&closeMenu();
  openLaneColorPopup(0, 300, 260); await new Promise(r=>setTimeout(r,150)); return true;
`);
await shot('r223-item2-swatches');
await fn(`document.querySelectorAll('.lanecolpop').forEach(m=>m.remove()); return true;`);

// ---- ÍTEM 3: ctx menu de pista de AUDIO ofrece las dos opciones ----
out.item3 = await fn(`
  closeMenu&&closeMenu(); await new Promise(r=>setTimeout(r,60));
  const aud=state.lanes.findIndex(l=>l.kind==='audio');
  const hd=document.querySelector('.lanehdr[data-lane="'+aud+'"]');
  hd.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:120,clientY:400}));
  await new Promise(r=>setTimeout(r,120));
  const onAudio=[...document.querySelectorAll('.menu button')].map(b=>b.textContent.trim());
  closeMenu&&closeMenu(); await new Promise(r=>setTimeout(r,60));
  const hd0=document.querySelector('.lanehdr[data-lane="0"]');
  hd0.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:120,clientY:200}));
  await new Promise(r=>setTimeout(r,120));
  const onVideo=[...document.querySelectorAll('.menu button')].map(b=>b.textContent.trim());
  closeMenu&&closeMenu();
  const has=(a,s)=>a.some(x=>x.indexOf(s)>=0);
  return {onAudio:onAudio.filter(x=>/track|pista/i.test(x)), onVideo:onVideo.filter(x=>/track|pista/i.test(x)),
    audioHasBoth: has(onAudio,'New video track')&&has(onAudio,'New audio track'),
    videoHasBoth: has(onVideo,'New video track')&&has(onVideo,'New audio track')};
`);

// ---- ÍTEM 4a: selección INDEPENDIENTE (clic en el vídeo no selecciona el audio) ----
out.item4_sel = await fn(`
  const {A,Aa}=window.__ids;
  const cd=document.querySelector('.clip[data-clip="'+A+'"]'); const r=cd.getBoundingClientRect();
  const opt={bubbles:true,button:0,clientX:r.left+r.width/2,clientY:r.top+3};
  cd.dispatchEvent(new PointerEvent('pointerdown',opt));
  window.dispatchEvent(new PointerEvent('pointerup',opt));
  await new Promise(r=>setTimeout(r,80));
  return {selId:state.selId, selIds:[...state.selIds], A, Aa, audioSelected:state.selIds.includes(Aa)};
`);

// ---- ÍTEM 4b: fades independientes — fade de vídeo NO toca el audio ----
out.item4_fade = await fn(`
  const {A,Aa}=window.__ids; const cA=clipById(A), cAa=clipById(Aa);
  cA.fadeIn=0; cAa.fadeIn=0;
  const cd=document.querySelector('.clip[data-clip="'+A+'"]'); const r=cd.getBoundingClientRect();
  const fh=cd.querySelector('.fadeh.fadeL'); const fr=fh.getBoundingClientRect();
  const x0=fr.left+fr.width/2, y0=fr.top+5;
  fh.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:x0,clientY:y0}));
  // arrastrar hacia DENTRO (a la derecha) ~1s
  const px=state.tl.pxPerSec;
  window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:x0+px*1.0,clientY:y0}));
  window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:x0+px*1.0,clientY:y0}));
  await new Promise(r=>setTimeout(r,120));
  return {videoFadeIn:+clipById(A).fadeIn.toFixed(3), audioFadeIn:+(clipById(Aa).fadeIn||0).toFixed(3),
    audioUntouched:(clipById(Aa).fadeIn||0)<1e-6};
`);

// ---- ÍTEM 4c: link = mover/trim/speed/loop juntos ----
out.item4_link = await fn(`
  const {A,Aa}=window.__ids; clipById(A).fadeIn=0;
  // speed juntos
  setClipSpeed(clipById(A),200);
  const sp={v:clipById(A).speed, a:clipById(Aa).speed, vdur:+clipById(A).dur.toFixed(3), adur:+clipById(Aa).dur.toFixed(3)};
  setClipSpeed(clipById(A),100);
  // loop juntos
  toggleLoop(clipById(A));
  const lp={v:!!clipById(A).loop, a:!!clipById(Aa).loop};
  toggleLoop(clipById(A));
  const lp2={v:!!clipById(A).loop, a:!!clipById(Aa).loop};
  // trim juntos (trimNudge, camino con linkBase)
  const before={v:+clipById(A).dur.toFixed(3), a:+clipById(Aa).dur.toFixed(3)};
  state.selId=A; state.selIds=[A]; state.playhead=clipById(A).start+clipById(A).dur; // borde derecho → roll con el vecino
  trimNudge(1, 15); // +0.5s (hacia la izquierda el roll está topado: B tiene inP=0 y no puede tirar antes de su origen)
  const after={v:+clipById(A).dur.toFixed(3), a:+clipById(Aa).dur.toFixed(3)};
  undo();
  return {speed:sp, loopOn:lp, loopOff:lp2, trimBefore:before, trimAfter:after,
    trimTogether: Math.abs((after.v-before.v)-(after.a-before.a))<0.01 && Math.abs(after.v-before.v)>0.01};
`);

// ---- ÍTEM 5: libertad vertical — mover el vídeo a V2 NO mueve el audio; el audio nunca cae en pista de vídeo ----
out.item5 = await fn(`
  const {A,Aa}=window.__ids;
  const restore=JSON.parse(JSON.stringify(state.clips.map(c=>({id:c.id,lane:c.lane,start:c.start,dur:c.dur}))));
  const before={vLane:clipById(A).lane, aLane:clipById(Aa).lane};
  const cd=document.querySelector('.clip[data-clip="'+A+'"]'); const r=cd.getBoundingClientRect();
  const row2=document.querySelector('#tracks .lane[data-lane="1"]'); const r2=row2.getBoundingClientRect();
  const x0=r.left+r.width/2, y0=r.top+3;
  cd.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:x0,clientY:y0}));
  window.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:x0+4,clientY:r2.top+r2.height/2}));
  await new Promise(r=>setTimeout(r,60));
  window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:x0+4,clientY:r2.top+r2.height/2}));
  await new Promise(r=>setTimeout(r,150));
  const after={vLane:clipById(A).lane, aLane:clipById(Aa).lane};
  // ¿algún clip de audio en pista de vídeo?
  const misplaced=state.clips.filter(c=>c.avRole==='a'&&state.lanes[c.lane].kind!=='audio').length;
  // el audio de A sigue en pista de audio
  return {before, after, videoMoved: after.vLane!==before.vLane, audioStayed: after.aLane===before.aLane,
    audioLaneKind: state.lanes[after.aLane].kind, misplacedAudioClips: misplaced};
`);
await shot('r223-item5-vertical');

// ---- ÍTEM 7: locators en la MITAD INFERIOR de la regla ----
out.item7 = await fn(`
  state.markers=[]; state.playhead=3; addMarker();
  await new Promise(r=>setTimeout(r,200));
  const inp=document.querySelector('body > input[type=text]'); if(inp){ inp.value='LOC1'; inp.blur(); }
  await new Promise(r=>setTimeout(r,200));
  document.querySelectorAll('body > input[type=text]').forEach(x=>{try{x.remove();}catch(_){}});
  renderTimeline(); await new Promise(r=>setTimeout(r,120));
  const cv=document.querySelector('#rulerCv'); const RH=cv.getBoundingClientRect().height;
  const cx=cv.getContext('2d'); const dpr=Math.min(window.devicePixelRatio||1,2);
  const x=Math.round((3*state.tl.pxPerSec - ($('#tlscroll').scrollLeft||0))*dpr);
  // recorrer la columna del locator y ver en qué mitad hay tinta
  const col=cx.getImageData(Math.max(0,x-1),0,3,cv.height).data;
  let topInk=0, botInk=0; const half=cv.height/2;
  for(let yy=0; yy<cv.height; yy++) for(let k=0;k<3;k++){ const i=((yy*3)+k)*4; const a=col[i+3];
    if(a>40){ if(yy<half) topInk++; else botInk++; } }
  return {rulerH:RH, cvH:cv.height, half, topInk, botInk, inLowerHalf: botInk>topInk*2 && botInk>4,
    markers: state.markers.map(m=>({t:m.time,name:m.name}))};
`);
await shot('r223-item7-locator');

// ---- ÍTEM 8: Ctrl+R con locator presente renombra el CLIP seleccionado ----
out.item8 = await fn(`
  const {A}=window.__ids;
  // limpiar restos de UI de los tests anteriores (un .overlay abierto corta TODOS los atajos)
  document.querySelectorAll('.overlay,.lanecolpop').forEach(x=>x.remove()); closeMenu&&closeMenu();
  document.querySelectorAll('body > input[type=text]').forEach(x=>{try{x.remove();}catch(_){}});
  const blockers={overlay:!!document.querySelector('.overlay'), exOv:!!document.getElementById('exOv'), selFolder:state.selFolder||null, mediaSel:selectedMediaIds().length};
  // hay un locator (del ítem 7). Seleccionar el clip por clic (debe apagar selMarkerId)
  const cd=document.querySelector('.clip[data-clip="'+A+'"]'); const r=cd.getBoundingClientRect();
  const o={bubbles:true,button:0,clientX:r.left+r.width/2,clientY:r.top+3};
  cd.dispatchEvent(new PointerEvent('pointerdown',o)); window.dispatchEvent(new PointerEvent('pointerup',o));
  await new Promise(r=>setTimeout(r,100));
  const afterClick={selMarkerId:state.selMarkerId, selId:state.selId, markers:state.markers.length};
  // Ctrl+R
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'r',code:'KeyR',ctrlKey:true,bubbles:true}));
  await new Promise(r=>setTimeout(r,250));
  // ¿qué se está editando? el título del clip (contentEditable en el .tt) o un input flotante sobre la regla
  const ce=document.querySelector('[contenteditable=true]');
  const floatInput=document.querySelector('body > input[type=text]');
  const editingClip = !!(ce && ce.closest && ce.closest('.clip'));
  const editingClipId = editingClip ? +ce.closest('.clip').dataset.clip : null;
  const res={blockers, afterClick, editingClip, editingClipId, editingLocator: !!floatInput, targetIsSelectedClip: editingClipId===A};
  if(ce) ce.blur();
  if(floatInput) floatInput.remove();
  await new Promise(r=>setTimeout(r,120));
  // control: ahora SELECCIONAR el locator y pulsar Ctrl+R → debe renombrar el LOCATOR (la prioridad sigue existiendo)
  const mk=state.markers[0]; state.selMarkerId=mk.id; state.selId=null; state.selIds=[]; renderTimeline();
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'r',code:'KeyR',ctrlKey:true,bubbles:true}));
  await new Promise(r=>setTimeout(r,250));
  res.locatorPathStillWorks = !!document.querySelector('body > input[type=text]');
  document.querySelectorAll('body > input[type=text]').forEach(x=>{try{x.remove();}catch(_){}});
  return res;
`);
await shot('r223-item8-ctrlR');

console.log(JSON.stringify(out, null, 2));
console.log('\\nERRS', JSON.stringify(await errs(), null, 1));
close();
