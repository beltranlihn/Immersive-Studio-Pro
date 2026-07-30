// [R228] parte 4 — regresión: los 3 formatos desde el launcher, reciente, undo/redo, guardar+reabrir un demo,
// borrar secuencia (appConfirm real) y el paso «Canvas» del recorrido de 2D en pantalla.
import { evalInApp } from './cdp.mjs';
import { shot } from './r228-shot.mjs';
const run = async (k, e) => { const v = await evalInApp(e, { timeout: 90000 }); console.log('· ' + k + ' → ' + JSON.stringify(v)); return v; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const H = `const tick=ms=>new Promise(r=>setTimeout(r,ms));
  const snap=()=>({lch:lchShowing(), back:!!document.getElementById('lchBack'), volver:_lchVolver, consent:lchConsent(), dirty:state.dirty, seq:(activeSeq()||{}).name, mode:state.seqMode});`;

// ---- demo dome: undo/redo ----
await run('demo-undo-redo', `(async()=>{ ${H}
  state.dirty=false; await startDemoProject('dome'); await tick(600);
  const n0=state.clips.length, undoInicial=(_undoBySeq[state.activeSeqId]||{u:[]}).u.length;
  const c=clipById(_demoRefs.fxClipId); const y0=JSON.stringify(c.props);
  pushUndo(); c.props.opacity=33; markDirty(); renderTimeline();
  undo(); const trasUndo=clipById(_demoRefs.fxClipId).props.opacity;
  redo(); const trasRedo=clipById(_demoRefs.fxClipId).props.opacity;
  undo();
  return {clips:n0, undoInicial, trasUndo, trasRedo, clipsFinal:state.clips.length, opacidadFinal:clipById(_demoRefs.fxClipId).props.opacity}; })()`);

// ---- guardar el demo a disco y reabrirlo (sin diálogo nativo: DSP.writeText/readText directos) ----
await run('demo-guardar-y-reabrir', `(async()=>{ ${H}
  await startDemoProject('room'); await tick(700);
  const antes={clips:state.clips.length, mode:state.seqMode,
    eases:[...new Set(state.clips.flatMap(c=>Object.values(c.kf||{}).flat().map(k=>k.e)))],
    curvas:state.clips.flatMap(c=>Object.keys(c.kf||{})).sort(),
    fx:state.clips.flatMap(c=>(c.fx||[]).map(f=>f.type)).sort(),
    nests:state.media.filter(m=>m.kind==='nest').length,
    muros:((activeSeq()||{}).room||{walls:[]}).walls.length};
  const ruta=String.raw\`C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro\\scratchpad\\r228-demo-room.isp\`;
  const ok=await DSP.writeText(ruta, JSON.stringify(serProject()));
  if(ok===false)return {err:'no se pudo escribir'};
  const txt=await DSP.readText(ruta); const obj=JSON.parse(txt);
  currentPath=ruta; state.dirty=false; loadProject(obj); await tick(1200);
  const despues={clips:state.clips.length, mode:state.seqMode,
    eases:[...new Set(state.clips.flatMap(c=>Object.values(c.kf||{}).flat().map(k=>k.e)))],
    curvas:state.clips.flatMap(c=>Object.keys(c.kf||{})).sort(),
    fx:state.clips.flatMap(c=>(c.fx||[]).map(f=>f.type)).sort(),
    nests:state.media.filter(m=>m.kind==='nest').length,
    muros:((activeSeq()||{}).room||{walls:[]}).walls.length};
  return {antes, despues, identico:JSON.stringify(antes)===JSON.stringify(despues), bytes:txt.length, volverTrasCargar:_lchVolver, consentTrasCargar:lchConsent()}; })()`);

// ---- abrir un reciente desde el launcher ----
await run('launcher-abrir-reciente', `(async()=>{ ${H}
  const ruta=String.raw\`C:\\Users\\beltr\\Desktop\\Alma Digital Studio\\Projects\\Immersive Studio Pro\\scratchpad\\r228-demo-room.isp\`;
  addRecent(ruta,null); state.dirty=false; showLanding(); await tick(200);
  const card=document.querySelector('.lch-rcard[data-path*="r228-demo-room"]'); if(!card)return {err:'el reciente no aparece', recientes:[...document.querySelectorAll('.lch-rcard')].map(c=>c.dataset.path)};
  card.click(); await tick(1500);
  return Object.assign(snap(),{clips:state.clips.length, muros:((activeSeq()||{}).room||{walls:[]}).walls.length}); })()`);

// ---- borrar una secuencia: appConfirm de 2 botones en un flujo REAL ----
await run('cf-flujo-real-borrar-secuencia', `(async()=>{ ${H}
  const kd=k=>document.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true}));
  const seqs=state.media.filter(isSeqMedia); const victima=seqs.find(s=>s.id!==state.activeSeqId);
  if(!victima)return {saltado:'sólo '+seqs.length+' secuencia(s)'};
  const n0=seqs.length;
  deleteSequenceMedia(victima.id); await tick(90);
  const ov=document.getElementById('confirmOv'); const msg=ov?ov.querySelector('div').textContent.slice(0,60):null;
  const botones=ov?[...ov.querySelectorAll('button')].map(b=>b.id+'='+b.textContent):null;
  kd('Escape'); await tick(90); const trasEsc=state.media.filter(isSeqMedia).length;
  deleteSequenceMedia(victima.id); await tick(90); kd('Enter'); await tick(250);
  return {mensaje:msg, botones, seqsAntes:n0, trasEscape:trasEsc, trasEnter:state.media.filter(isSeqMedia).length}; })()`);

// ---- demo 2D con el copy nuevo, en pantalla ----
await run('demo-flat-tour-hasta-canvas', `(async()=>{ ${H}
  state.dirty=false; await startDemoProject('flat'); await tick(700);
  if(_tourStop)_tourStop(); startTour('flat',true); await tick(200);
  const card=()=>document.querySelector('#tourOv > div:nth-child(2)');
  for(let i=0;i<12;i++){ const t=card().querySelector('div:nth-child(2)').textContent; if(t.indexOf('anvas')>=0||t.indexOf('ienzo')>=0)break; card().querySelector('#tourNext').click(); await tick(60); }
  const b3=document.querySelector('#viewModeSeg button[data-v="3d"]'), b2=document.querySelector('#viewModeSeg button[data-v="2d"]');
  return {paso:card().querySelector('div:nth-child(1)').textContent, titulo:card().querySelector('div:nth-child(2)').textContent,
    cuerpo:card().querySelector('div:nth-child(3)').textContent, b3oculto:b3.style.display==='none', b2:b2.textContent.trim()}; })()`);

await sleep(400);
console.log('· captura → ' + await shot('scratchpad/r228-demo-flat-canvas.png'));

await run('cerrar-tour', `(()=>{ if(_tourStop)_tourStop(); return !document.getElementById('tourOv'); })()`);
await run('errs', `(window.__errs||[])`);
await run('diag-errores', `DIAG.buf.filter(e=>e.level==='error').map(e=>e.tag+':'+e.msg).slice(-12)`);
