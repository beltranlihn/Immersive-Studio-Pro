// [R226] interacción entre las dos mitades: máscara en el lienzo del editor + ventana solo-visor abierta
import { run, runIn, shot } from './cdp2.mjs';
import { errsHook, flatScene } from './setup.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await errsHook();
console.log('escena', JSON.stringify(await flatScene()));
console.log('mask', await run(`document.getElementById('penAdd').click();
  const mk=selClip().penMasks[0]; mk.pts=[[0.25,0.2],[0.8,0.3],[0.7,0.85],[0.3,0.7]]; rasterizePenMasks(selClip()); render();
  return {editing:!!maskEditClip(), pts:mk.pts.length};`));
console.log('abrir ventana', JSON.stringify(await run(`openViewerWindow(); return {open:viewerOpen(), eff:viewerMode()};`)));
await wait(1000);
console.log(await shot('c-01-editor-con-mascara-y-ventana'));
console.log(await shot('c-01b-ventana-sin-chrome-de-edicion','Viewer'));
// mover un punto con la ventana abierta
console.log('drag con ventana', JSON.stringify(await run(`
  const c=selClip(),m=mediaById(c.mediaId),t=state.playhead, r=gridc.getBoundingClientRect();
  const q=penPtPix(c,m,t,c.penMasks[0].pts[0],null); const tgt=penPix(c,m,t,-0.9,-0.9,null);
  gridc.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.left+q[0],clientY:r.top+q[1],button:0,bubbles:true,pointerId:3}));
  gridc.dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+tgt[0],clientY:r.top+tgt[1],bubbles:true,pointerId:3}));
  gridc.dispatchEvent(new PointerEvent('pointerup',{clientX:r.left+tgt[0],clientY:r.top+tgt[1],bubbles:true,pointerId:3}));
  const after=penPtPix(c,m,t,c.penMasks[0].pts[0],null);
  return {objetivo:[Math.round(tgt[0]),Math.round(tgt[1])], quedo:[Math.round(after[0]),Math.round(after[1])]};`)));
await wait(400);
console.log(await shot('c-02-editor-punto-movido-con-ventana'));
console.log(await shot('c-02b-ventana-tras-mover','Viewer'));
// salir del modo y comprobar que los tiradores del clip volvieron
console.log('done + tiradores', JSON.stringify(await run(`
  endMaskEdit(); render();
  const n=_flatHandles?_flatHandles.length:0;
  const r=gridc.getBoundingClientRect(); const h=_flatHandles&&_flatHandles[0];
  let modo=null; if(h){ gridc.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.left+h.px,clientY:r.top+h.py,button:0,bubbles:true,pointerId:4})); modo=vdrag&&vdrag.mode; gridc.dispatchEvent(new PointerEvent('pointerup',{clientX:r.left+h.px,clientY:r.top+h.py,bubbles:true,pointerId:4})); }
  return {handles:n, vdragMode:modo};`)));
await wait(500);
console.log('tiradores tras repintar la ventana', JSON.stringify(await run(`vDirty(); return 1;`)));
await wait(400);
console.log(JSON.stringify(await run(`return {handles:_flatHandles?_flatHandles.length:0, editorCanvas:[glc.width,glc.height], viewCw:view.cw};`)));
console.log('__errs', await run(`return (window.__errs||[]).slice(0,6);`));
