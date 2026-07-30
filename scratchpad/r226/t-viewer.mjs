// [R226·V1] verificación de la ventana solo-visor
import { run, runIn, shot, list } from './cdp2.mjs';
import { errsHook, domeScene, roomScene, killTour } from './setup.mjs';
const V='Viewer';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await errsHook();
const scene = process.argv[2]||'dome';
console.log('escena', scene, JSON.stringify(scene==='room'?await roomScene():await domeScene()));

const t0=Date.now();
console.log('open', JSON.stringify(await run(`openViewerWindow(); return {win:viewerOpen(), eff:viewerMode(), raf:_vRaf>0};`,{timeout:15000})), Date.now()-t0+'ms');
await wait(700);
console.log('targets', (await list()).map(t=>t.title));
console.log(await shot(`v-${scene}-01-principal-2d`));
console.log(await shot(`v-${scene}-01b-ventana-3d`, V));

// --- toolbar dentro de la ventana ---
console.log('bar', JSON.stringify(await runIn(V,`const b=document.getElementById('vwbar');
  return {exists:!!b, buttons:[...b.querySelectorAll('button')].map(x=>x.dataset.a+(x.classList.contains('on')?'*':'')), color:getComputedStyle(b.querySelector('button')).color};`)));

// --- grid on/off cambia píxeles ---
const gridDiff = await runIn(V, `
  const cv=document.getElementById('vwcv'); const cx=cv.getContext('2d');
  const snap=()=>{ const d=cx.getImageData(0,0,cv.width,cv.height).data; let s=0; for(let i=0;i<d.length;i+=41)s+=d[i]; return s; };
  const a=snap();
  document.querySelector('#vwbar [data-a="grid"]').click();
  return new Promise(res=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{ const b=snap(); res({antes:a, despues:b, cambio:a!==b}); }))));`);
console.log('grid toggle', JSON.stringify(gridDiff));
console.log(await shot(`v-${scene}-02-grid-on`, V));

// --- overlay contextual ---
console.log('overlay', JSON.stringify(await runIn(V,`const b=document.querySelector('#vwbar [data-a="ovl"]'); const lbl=b.textContent; b.click(); return {label:lbl};`)));
await wait(200); console.log(await shot(`v-${scene}-03-overlay-on`, V));

// --- 3D: Orbit/Viewer + drag para orbitar ---
const orbit = await runIn(V, `
  const cv=document.getElementById('vwcv'); const r=cv.getBoundingClientRect();
  const cx=cv.getContext('2d');
  const snap=()=>{ const d=cx.getImageData(0,0,cv.width,cv.height).data; let s=0; for(let i=0;i<d.length;i+=41)s+=d[i]; return s; };
  const a=snap();
  cv.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.width/2,clientY:r.height/2,button:0,bubbles:true,pointerId:9}));
  window.dispatchEvent(new PointerEvent('pointermove',{clientX:r.width/2+180,clientY:r.height/2+40,bubbles:true,pointerId:9}));
  window.dispatchEvent(new PointerEvent('pointerup',{clientX:r.width/2+180,clientY:r.height/2+40,bubbles:true,pointerId:9}));
  cv.dispatchEvent(new WheelEvent('wheel',{deltaY:-300,bubbles:true,cancelable:true}));
  return new Promise(res=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>res({antes:a,despues:snap(),cambio:a!==snap()})))));`);
console.log('orbit drag+wheel', JSON.stringify(orbit));
console.log('cam', JSON.stringify(await run(`return {yaw:+_vCam.yaw.toFixed(3), pitch:+_vCam.pitch.toFixed(3), dist:+_vCam.dist.toFixed(3), three:_vThree};`)));
console.log(await shot(`v-${scene}-04-orbitada`, V));

// --- Orbit → Viewer ---
console.log('three seg', JSON.stringify(await runIn(V,`const b=document.querySelector('#vwbar [data-a="spec"]'); if(!b)return {err:'sin segmento 3D'}; b.click(); return {ok:1};`)));
await wait(250); console.log(await shot(`v-${scene}-05-modo-espectador`, V));
await runIn(V,`const b=document.querySelector('#vwbar [data-a="orbit"]'); if(b)b.click(); return 1;`);

// --- complementariedad EN VIVO: pasar el editor a 3D ⇒ ventana a 2D ---
console.log('editor→3d', JSON.stringify(await run(`state.view.mode='3d'; resize(); return {editor:state.view.mode, ventana:viewerMode()};`)));
await wait(400); console.log(await shot(`v-${scene}-06-principal-3d`));
console.log(await shot(`v-${scene}-06b-ventana-2d`, V));

// --- override manual y su liberación ---
console.log('override', JSON.stringify(await runIn(V,`document.querySelector('#vwbar [data-a="3d"]').click(); return 1;`)));
await wait(250);
console.log('override activo', JSON.stringify(await run(`return {vMode:_vMode, eff:viewerMode(), editor:state.view.mode};`)));
console.log(await shot(`v-${scene}-07-override-3d`, V));
console.log('editor→2d suelta el override', JSON.stringify(await run(`state.view.mode='2d'; resize(); const e=viewerMode(); return {vMode:_vMode, eff:e, editor:state.view.mode};`)));
await wait(300); console.log(await shot(`v-${scene}-08-override-soltado`, V));

// --- coste: fps del editor con la ventana abierta, 10 s de reproducción ---
await run(`window.__fps=null; state.playhead=0; let n=0; const t0=performance.now();
  const raf=()=>{ n++; if(performance.now()-t0<10000) requestAnimationFrame(raf); else { window.__fps=+(n/((performance.now()-t0)/1000)).toFixed(1); pause(); } };
  requestAnimationFrame(raf); play(); return 1;`);
await wait(11000);
console.log('fps editor 10s CON ventana:', await run(`return window.__fps;`));
console.log('paint cost', JSON.stringify(await run(`
  const N=30; let t=performance.now(); for(let i=0;i<N;i++){ _vDirty=true; viewerPaint(); } const withV=(performance.now()-t)/N;
  t=performance.now(); for(let i=0;i<N;i++) render(); const only=(performance.now()-t)/N;
  return {msViewerPaint:+withV.toFixed(2), msRenderSolo:+only.toFixed(2)};`,{timeout:40000})));

// --- cerrar y reabrir ---
console.log('close', JSON.stringify(await run(`_viewerWin.close(); return 1;`)));
await wait(800);
console.log('tras cerrar', JSON.stringify(await run(`render(); return {open:viewerOpen(), raf:_vRaf, editorOk:(glc.width>0&&gridc.width>0), errs:(window.__errs||[]).length};`)));
console.log(await shot(`v-${scene}-09-editor-tras-cerrar`));
console.log('reopen', JSON.stringify(await run(`openViewerWindow(); return {open:viewerOpen(), eff:viewerMode()};`)));
await wait(700); console.log(await shot(`v-${scene}-10-reabierta`, V));
console.log('__errs', await run(`return (window.__errs||[]).slice(0,8);`));
