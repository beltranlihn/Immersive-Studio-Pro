// [R226·I3] verificación de la pen mask editada en el lienzo del visor
import { run, shot } from './cdp2.mjs';
import { errsHook, domeScene, flatScene } from './setup.mjs';
const px = (name)=>shot(name);
await errsHook();
const mode = process.argv[2]||'flat';
console.log('escena', mode, JSON.stringify(mode==='dome'?await domeScene():await flatScene()));
await px(`m-${mode}-00-base`);

// --- crear la máscara desde el inspector (botón Add mask) ---
console.log('addMask', await run(`
  const c=selClip(); const b=document.getElementById('penAdd');
  if(!b) return {err:'no #penAdd', tabs:[...document.querySelectorAll('#fxRows')].length};
  b.click();
  return {masks:(selClip().penMasks||[]).length, editing:(maskEditClip()===selClip()), sel:selClip()._penSel, mask:selClip().props.mask, vmode:state.view.mode};`));
await px(`m-${mode}-01-add-mask-entra-al-lienzo`);

// --- geometría: ¿los 4 puntos por defecto caen DENTRO del rect/casquete del clip? ---
console.log('geom', await run(`
  const c=selClip(), m=mediaById(c.mediaId), t=state.playhead;
  const mk=c.penMasks[0];
  const B=isFlat()?null:penDomeBasis(c,m,t);
  const pts=mk.pts.map(p=>penPtPix(c,m,t,p,B));
  // ida y vuelta: píxel → punto → píxel debe cerrar
  const rt=pts.map((q,i)=>{ if(!q)return null; const l=penFromPix(c,m,t,q[0],q[1],B); if(!l)return null; const p2=penUnlocal(c,l[0],l[1]); const q2=penPtPix(c,m,t,p2,B); return q2?[+(q2[0]-q[0]).toFixed(3),+(q2[1]-q[1]).toFixed(3)]:null; });
  return {pts:pts.map(q=>q&&[Math.round(q[0]),Math.round(q[1])]), roundtripErrPx:rt, cw:view.cw, ch:view.ch};`));

// --- gestos sobre el canvas: añadir 3 puntos más (clic), mover uno (drag), borrar uno (dblclick) ---
const gest = await run(`
  const cv=gridc, r=cv.getBoundingClientRect();
  const c=selClip(), m=mediaById(c.mediaId), t=state.playhead;
  const B=isFlat()?null:penDomeBasis(c,m,t);
  const dn=(x,y,btn)=>cv.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.left+x,clientY:r.top+y,button:btn||0,bubbles:true,pointerId:1}));
  const mv=(x,y)=>cv.dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+x,clientY:r.top+y,bubbles:true,pointerId:1}));
  const up=(x,y)=>cv.dispatchEvent(new PointerEvent('pointerup',{clientX:r.left+x,clientY:r.top+y,bubbles:true,pointerId:1}));
  const dbl=(x,y)=>cv.dispatchEvent(new MouseEvent('dblclick',{clientX:r.left+x,clientY:r.top+y,bubbles:true}));
  // 3 clics en posiciones válidas dentro del clip (a_flat conocido → píxel)
  const add=[[0.2,-0.85],[0.85,0.2],[-0.85,-0.2]];
  const before=c.penMasks[0].pts.length;
  for(const [s,tt] of add){ const q=penPix(c,m,t,s,tt,B); if(!q){continue;} dn(q[0],q[1]); up(q[0],q[1]); }
  const afterAdd=c.penMasks[0].pts.length;
  window.__q0=penPtPix(c,m,t,c.penMasks[0].pts[0],B);
  return {before,afterAdd,pts:JSON.parse(JSON.stringify(c.penMasks[0].pts))};`);
console.log('add pts', JSON.stringify(gest));
await px(`m-${mode}-02-siete-puntos`);

const drag = await run(`
  const cv=gridc, r=cv.getBoundingClientRect();
  const c=selClip(), m=mediaById(c.mediaId), t=state.playhead;
  const B=isFlat()?null:penDomeBasis(c,m,t);
  const q0=window.__q0; const before=JSON.parse(JSON.stringify(c.penMasks[0].pts[0]));
  const tgt=penPix(c,m,t,-0.2,-0.2,B);
  cv.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.left+q0[0],clientY:r.top+q0[1],button:0,bubbles:true,pointerId:1}));
  const dragging=!!_maskDrag;
  cv.dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+tgt[0],clientY:r.top+tgt[1],bubbles:true,pointerId:1}));
  cv.dispatchEvent(new PointerEvent('pointerup',{clientX:r.left+tgt[0],clientY:r.top+tgt[1],bubbles:true,pointerId:1}));
  const after=JSON.parse(JSON.stringify(c.penMasks[0].pts[0]));
  const landed=penPtPix(c,m,t,after,B);
  return {dragging,before,after,moved:(before[0]!==after[0]||before[1]!==after[1]),targetPx:[Math.round(tgt[0]),Math.round(tgt[1])],landedPx:landed&&[Math.round(landed[0]),Math.round(landed[1])],dragCleared:!_maskDrag};`);
console.log('drag', JSON.stringify(drag));
await px(`m-${mode}-03-punto-movido`);

const del = await run(`
  const cv=gridc, r=cv.getBoundingClientRect();
  const c=selClip(), m=mediaById(c.mediaId), t=state.playhead;
  const B=isFlat()?null:penDomeBasis(c,m,t);
  const n0=c.penMasks[0].pts.length; const q=penPtPix(c,m,t,c.penMasks[0].pts[2],B);
  cv.dispatchEvent(new MouseEvent('dblclick',{clientX:r.left+q[0],clientY:r.top+q[1],bubbles:true}));
  return {n0,n1:c.penMasks[0].pts.length};`);
console.log('dblclick delete', JSON.stringify(del));
await px(`m-${mode}-04-punto-borrado`);

// --- ¿el composite recorta de verdad? píxeles dentro vs fuera del polígono ---
const cut = await run(`
  const c=selClip(); const before=c.props.mask;
  const sample=()=>{ render(); const g=glc.getContext&&null; const b=new Uint8Array(4);
    // muestreo en el centro del clip y en una esquina del clip (fuera del polígono)
    return null; };
  return {mask:before, hasTex:!!c.maskTex, penActive:penMaskActive(c)};`);
console.log('mask state', JSON.stringify(cut));

// --- Done sale del modo y devuelve los gestos normales ---
console.log('done', await run(`
  const c=selClip(); const b=document.getElementById('penEdit'); const lblBefore=b&&b.textContent.trim();
  b.click();
  const c2=selClip();
  // gesto normal: arrastrar el clip debe moverlo otra vez
  const r=gridc.getBoundingClientRect(); const x0=r.width/2,y0=r.height/2;
  const p0=isFlat()?[c2.props.x,c2.props.y]:[c2.props.az,c2.props.el];
  gridc.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.left+x0,clientY:r.top+y0,button:0,bubbles:true,pointerId:2}));
  const vd=vdrag&&vdrag.mode;
  gridc.dispatchEvent(new PointerEvent('pointerup',{clientX:r.left+x0,clientY:r.top+y0,bubbles:true,pointerId:2}));
  return {lblBefore, editing:!!maskEditClip(), vdragMode:vd};`));
await px(`m-${mode}-05-done`);

// --- reabrir la edición: los puntos siguen donde tocaba ---
console.log('reabrir', await run(`
  const c=selClip(); renderInspector(); const b=document.getElementById('penEdit'); b.click();
  const m=mediaById(c.mediaId),t=state.playhead; const B=isFlat()?null:penDomeBasis(c,m,t);
  return {editing:maskEditClip()===c, pts:c.penMasks[0].pts.length, px:c.penMasks[0].pts.map(p=>{const q=penPtPix(c,m,t,p,B);return q&&[Math.round(q[0]),Math.round(q[1])];})};`));
await px(`m-${mode}-06-reabierto`);

// --- Escape sale ---
console.log('escape', await run(`
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  return {editing:!!maskEditClip()};`));

// --- undo / redo ---
console.log('undo/redo', await run(`
  const c=selClip(); const n=c.penMasks[0].pts.length; undo();
  const a=(clipById(c.id)||{penMasks:[{pts:[]}]}).penMasks[0].pts.length; redo();
  const b=(clipById(c.id)||{penMasks:[{pts:[]}]}).penMasks[0].pts.length;
  return {n, afterUndo:a, afterRedo:b};`));

console.log('__errs', await run(`return (window.__errs||[]).slice(0,8);`));
