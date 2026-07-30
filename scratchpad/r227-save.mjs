import { connect } from './r227-lib.mjs';
const { evalExpr, wait, ws } = await connect();
const call=e=>evalExpr(`(function(){ ${e} return 1; })()`);
const P='C:/Users/beltr/Desktop/Alma Digital Studio/Projects/Immersive Studio Pro/scratchpad/r227-demo-save.isp';
// 1) demo de domo + skip del tour a mitad
await call(`state.dirty=false;`);
await call(`startDemoProject('dome');`); await wait(1500);
await call(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})); document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));`); await wait(300);
console.log('tour en paso 3:', await evalExpr(`(function(){ const ov=document.getElementById('tourOv'); return ov?ov.children[1].children[0].textContent:null; })()`));
await call(`document.getElementById('tourSkip').click();`); await wait(300);
console.log('tras Skip:', await evalExpr(`({tour:!!document.getElementById('tourOv'), dirty:state.dirty, clips:state.clips.length, path:currentPath})`));
// 2) editar (mover un clip) + undo/redo
console.log('edición + undo/redo:', await evalExpr(`(function(){
  const c=clipById(_demoRefs.autoClipId); const s0=c.start; pushUndo(); c.start=4; renderTimeline(); render(); markDirty();
  const tras=clipById(_demoRefs.autoClipId).start; undo(); const desUndo=clipById(_demoRefs.autoClipId).start; redo(); const desRedo=clipById(_demoRefs.autoClipId).start;
  return {s0, tras, desUndo, desRedo, dirty:state.dirty}; })()`));
// 3) guardar en una ruta conocida (sin diálogo nativo) y reabrir
await evalExpr(`(async function(){ currentPath=${JSON.stringify(P)}; await saveProject(false); return 1; })()`); await wait(600);
console.log('guardado:', await evalExpr(`({dirty:state.dirty, path:currentPath})`));
const info=await evalExpr(`(async function(){ const txt=await DSP.readText(${JSON.stringify(P)}); let o=null; try{o=JSON.parse(txt);}catch(e){ return {err:'JSON inválido'}; }
  return {bytes:txt.length, media:(o.media||[]).length, clips:(o.clips||o.seqs&&0)||((o.media||[]).find(m=>m.mode)?'seq-based':'?'), keys:Object.keys(o).slice(0,14)}; })()`);
console.log('archivo:', JSON.stringify(info));
// reabrir
console.log('reabierto:', await evalExpr(`(async function(){ const txt=await DSP.readText(${JSON.stringify(P)}); const o=JSON.parse(txt);
  state.dirty=false; loadProject(o);
  return {seqMode:state.seqMode, seq:activeSeq()&&activeSeq().name, clips:state.clips.length, lanes:state.lanes.map(l=>l.name),
    nest:!!state.media.find(m=>m.kind==='nest'&&(m.nestClips||[]).length), kf:state.clips.map(c=>Object.keys(c.kf||{}).length), anim:state.clips.map(c=>(c.anim||[]).length), fx:state.clips.map(c=>(c.fx||[]).length),
    startMovido:clipById(state.clips.map(c=>c.id).find(id=>true))?1:0 }; })()`));
console.log('errs:', JSON.stringify(await evalExpr(`window.__errs`)));
ws.close();
